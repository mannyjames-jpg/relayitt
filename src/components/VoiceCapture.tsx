import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, Square, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { transcribeVoiceNote } from "@/lib/voice.functions";
import { createTask } from "@/lib/tasks.functions";
import { cn } from "@/lib/utils";
import type { ContactOption } from "./AssigneeCombobox";

type Source = "From Boss" | "Delegated by Me" | "Personal Reminder";
type Priority = "Normal" | "Important" | "Urgent";
type Category =
  | "Travel"
  | "Household"
  | "Scheduling"
  | "Errands"
  | "Gifts/Events"
  | "Finance"
  | "Vendors"
  | "Other";

type Draft = {
  title: string;
  notes: string | null;
  source: Source;
  category: Category | null;
  priority: Priority;
  assigned_contact_id: string | null;
  assigned_to_name: string | null;
  due_date: string | null;
  due_time: string | null;
  /** Checked drafts are the ones that get imported. */
  selected: boolean;
  /** What the AI inferred, so we can mark unchanged values as suggested. */
  ai: { category: Category | null; priority: Priority | null };
};


const CATEGORIES: Category[] = [
  "Travel",
  "Household",
  "Scheduling",
  "Errands",
  "Gifts/Events",
  "Finance",
  "Vendors",
  "Other",
];

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return "audio/webm";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? "");
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function VoiceCapture({
  contacts,
}: {
  contacts: ContactOption[];
}) {
  const qc = useQueryClient();
  const transcribe = useServerFn(transcribeVoiceNote);
  const create = useServerFn(createTask);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<
    "idle" | "recording" | "processing" | "review"
  >("idle");
  const [elapsed, setElapsed] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [transcript, setTranscript] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMime, setAudioMime] = useState<string>("audio/webm");
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const structureM = useMutation({ mutationFn: transcribe });

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function releaseStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    return () => {
      stopTimer();
      releaseStream();
    };
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      setAudioMime(mime);
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        releaseStream();
        stopTimer();
        setAudioBlob(blob);
        setPhase("processing");
        try {
          const b64 = await blobToBase64(blob);
          const res = await structureM.mutateAsync({
            data: {
              audio_base64: b64,
              mime_type: mime,
              contacts: contacts.map((c) => ({ id: c.id, name: c.name })),
            },
          });
          setTranscript(res.transcript);
          setDrafts(
            res.drafts.map((d) => ({
              title: d.title,
              notes: d.notes ?? null,
              source: d.source,
              category: (d.category ?? null) as Category | null,
              priority: d.priority,
              assigned_contact_id: d.assigned_contact_id ?? null,
              assigned_to_name: d.assigned_to_name ?? null,
              due_date: d.due_date ?? null,
              due_time: d.due_time ?? null,
              selected: true,
              ai: {
                category: (d.category ?? null) as Category | null,
                priority: d.priority ?? null,
              },
            })),
          );

          setPhase("review");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Voice processing failed");
          setPhase("idle");
          setOpen(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setElapsed(0);
      setPhase("recording");
      timerRef.current = setInterval(
        () => setElapsed((s) => s + 1),
        1000,
      );
    } catch {
      toast.error("Microphone permission required to record.");
      setOpen(false);
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  function cancelAll() {
    stopTimer();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    releaseStream();
    setPhase("idle");
    setDrafts([]);
    setTranscript("");
    setAudioBlob(null);
    setElapsed(0);
    setOpen(false);
  }

  async function confirmAll() {
    if (drafts.length === 0) return;
    setSaving(true);
    try {
      // Upload audio once (all drafts from this note share the same audio + transcript).
      let uploadedPath: string | null = null;
      if (audioBlob) {
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes.user?.id;
        if (uid) {
          const ext = audioMime.includes("mp4")
            ? "m4a"
            : audioMime.includes("mpeg") || audioMime.includes("mp3")
              ? "mp3"
              : "webm";
          const path = `${uid}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("voice-notes")
            .upload(path, audioBlob, {
              contentType: audioMime,
              upsert: false,
            });
          if (!upErr) uploadedPath = path;
        }
      }

      for (const d of drafts) {
        await create({
          data: {
            title: d.title.trim() || "Untitled",
            source: d.source,
            notes: d.notes ?? null,
            category: d.category,
            priority: d.priority,
            assigned_to: d.assigned_contact_id,
            assigned_to_name: d.assigned_contact_id ? null : d.assigned_to_name,
            due_date: d.due_date,
            due_time: d.due_time,
            source_type: "Voice",
            voice_note_url: uploadedPath,
            raw_transcript: transcript || null,
          },
        });
      }
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(
        drafts.length === 1
          ? "Task added from voice note"
          : `${drafts.length} tasks added`,
      );
      cancelAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save tasks");
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(i: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function removeDraft(i: number) {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="h-11 w-11 shrink-0 p-0"
        aria-label="Record voice note"
        onClick={() => {
          setOpen(true);
          setTimeout(() => {
            void startRecording();
          }, 50);
        }}
      >
        <Mic className="h-5 w-5" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) cancelAll();
          else setOpen(true);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {phase === "review" ? "Review voice tasks" : "Voice note"}
            </DialogTitle>
          </DialogHeader>

          {phase === "recording" && (
            <div className="flex flex-col items-center gap-6 py-6">
              <div className="relative flex h-24 w-24 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-primary/20 animate-rec-pulse" />
                <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Mic className="h-6 w-6" />
                </span>
              </div>
              <div className="font-display text-3xl tabular-nums">
                {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
                {String(elapsed % 60).padStart(2, "0")}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={cancelAll}>
                  Cancel
                </Button>
                <Button onClick={stopRecording} className="gap-2">
                  <Square className="h-4 w-4" />
                  Stop
                </Button>
              </div>
            </div>
          )}

          {phase === "processing" && (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Transcribing and drafting tasks…</p>
            </div>
          )}

          {phase === "review" && (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {transcript && (
                <div className="rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                  <div className="mb-1 font-medium text-foreground/80">
                    Transcript
                  </div>
                  <p className="italic">"{transcript}"</p>
                </div>
              )}

              {drafts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nothing left to save.
                </p>
              )}

              {drafts.map((d, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card p-3 space-y-2 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <Input
                      value={d.title}
                      onChange={(e) => updateDraft(i, { title: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground"
                      aria-label="Discard draft"
                      onClick={() => removeDraft(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={d.notes ?? ""}
                    placeholder="Notes"
                    rows={2}
                    onChange={(e) =>
                      updateDraft(i, { notes: e.target.value || null })
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Source</Label>
                      <Select
                        value={d.source}
                        onValueChange={(v) =>
                          updateDraft(i, { source: v as Source })
                        }
                      >
                        <SelectTrigger className="mt-1 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="From Boss">From Boss</SelectItem>
                          <SelectItem value="Delegated by Me">
                            Delegated by Me
                          </SelectItem>
                          <SelectItem value="Personal Reminder">
                            Personal Reminder
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Priority</Label>
                      <Select
                        value={d.priority}
                        onValueChange={(v) =>
                          updateDraft(i, { priority: v as Priority })
                        }
                      >
                        <SelectTrigger className="mt-1 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Normal">Normal</SelectItem>
                          <SelectItem value="Important">Important</SelectItem>
                          <SelectItem value="Urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Category</Label>
                      <Select
                        value={d.category ?? "__none"}
                        onValueChange={(v) =>
                          updateDraft(i, {
                            category:
                              v === "__none" ? null : (v as Category),
                          })
                        }
                      >
                        <SelectTrigger className="mt-1 h-9">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">None</SelectItem>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Assign to</Label>
                      <Select
                        value={d.assigned_contact_id ?? "__none"}
                        onValueChange={(v) =>
                          updateDraft(i, {
                            assigned_contact_id:
                              v === "__none" ? null : v,
                            assigned_to_name:
                              v === "__none" ? d.assigned_to_name : null,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1 h-9">
                          <SelectValue
                            placeholder={d.assigned_to_name ?? "None"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">
                            {d.assigned_to_name
                              ? `Use "${d.assigned_to_name}"`
                              : "None"}
                          </SelectItem>
                          {contacts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Due date</Label>
                      <Input
                        type="date"
                        value={d.due_date ?? ""}
                        onChange={(e) =>
                          updateDraft(i, {
                            due_date: e.target.value || null,
                            due_time: e.target.value ? d.due_time : null,
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Time</Label>
                      <Input
                        type="time"
                        disabled={!d.due_date}
                        value={d.due_time ?? ""}
                        onChange={(e) =>
                          updateDraft(i, { due_time: e.target.value || null })
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className={cn("flex items-center justify-end gap-2 pt-2")}>
                <Button variant="ghost" onClick={cancelAll} disabled={saving}>
                  <X className="mr-1 h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  onClick={confirmAll}
                  disabled={saving || drafts.length === 0}
                >
                  {saving
                    ? "Saving…"
                    : drafts.length === 1
                      ? "Save task"
                      : `Save ${drafts.length} tasks`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
