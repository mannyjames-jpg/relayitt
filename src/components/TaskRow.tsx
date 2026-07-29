import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  BellRing,
  Calendar as CalIcon,
  Check,
  Circle,
  Clock,
  MessageCircleQuestion,
  MessageSquare,
  Phone,
  Play,
  PlayCircle,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PetalBurst } from "@/components/PetalBurst";
import {
  CATEGORY_COLOR,
  CATEGORY_PILL,
  STATUS_BADGE,
  STATUS_HELP,
  STATUS_ORDER,
  waitingLabel,
  type TaskStatus,
} from "@/lib/task-style";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  deleteTask,
  getVoiceNoteUrl,
  nudgeTask,
  updateTask,
} from "@/lib/tasks.functions";
import { addStep, deleteStep, listSteps } from "@/lib/steps.functions";
import { formatTime, daysSince } from "@/lib/date-utils";
import type { ContactOption } from "./AssigneeCombobox";
import { AssigneeCombobox } from "./AssigneeCombobox";

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  next_step?: string | null;
  source: "From Boss" | "Delegated by Me" | "Personal Reminder";
  status: TaskStatus;
  status_updated_at?: string | null;
  category:
    | "Travel"
    | "Household"
    | "Scheduling"
    | "Errands"
    | "Gifts/Events"
    | "Finance"
    | "Vendors"
    | "Other"
    | null;
  priority: "Normal" | "Important" | "Urgent";
  assigned_to: string | null;
  assigned_to_name: string | null;
  delegated_to_contact_id?: string | null;
  due_date: string | null;
  due_time: string | null;
  last_followup_at: string | null;
  next_followup_reminder_at?: string | null;
  source_type?: "Typed" | "Voice";
  voice_note_url?: string | null;
  raw_transcript?: string | null;
  created_at: string;
};

type Category = NonNullable<Task["category"]>;

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

const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
  "Not Started": <Circle className="h-3 w-3" />,
  "In Progress": <Play className="h-3 w-3" />,
  "Waiting on Someone": <MessageCircleQuestion className="h-3 w-3" />,
  Complete: <Check className="h-3 w-3" />,
};

export function TaskRow({
  task,
  contacts,
  showWaitingBadge,
  overdue,
}: {
  task: Task;
  contacts: ContactOption[];
  showWaitingBadge?: boolean;
  overdue?: boolean;
}) {
  const qc = useQueryClient();
  const update = useServerFn(updateTask);
  const del = useServerFn(deleteTask);
  const nudge = useServerFn(nudgeTask);
  const getVoice = useServerFn(getVoiceNoteUrl);

  const [expanded, setExpanded] = useState(false);
  const [burst, setBurst] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [nudgeFlash, setNudgeFlash] = useState(false);
  const [nudgeStep, setNudgeStep] = useState<
    null | "contact" | "status" | "reminder"
  >(null);
  const [remindDays, setRemindDays] = useState<number>(2);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [stepDraft, setStepDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [dueTime, setDueTime] = useState(task.due_time?.slice(0, 5) ?? "");
  const [contactId, setContactId] = useState<string | null>(task.assigned_to);
  const [freeText, setFreeText] = useState(task.assigned_to_name ?? "");
  const [category, setCategory] = useState<Category | null>(task.category);
  const [priority, setPriority] = useState<Task["priority"]>(task.priority);

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setStatus(task.status);
    setDueDate(task.due_date ?? "");
    setDueTime(task.due_time?.slice(0, 5) ?? "");
    setContactId(task.assigned_to);
    setFreeText(task.assigned_to_name ?? "");
    setCategory(task.category);
    setPriority(task.priority);
  }, [task]);

  const fetchSteps = useServerFn(listSteps);
  const createStep = useServerFn(addStep);
  const removeStep = useServerFn(deleteStep);

  const { data: allSteps = [] } = useQuery({
    queryKey: ["task-steps"],
    queryFn: () => fetchSteps(),
    staleTime: 30_000,
  });
  const steps = allSteps.filter((s) => s.task_id === task.id);
  const latestStep = steps[0] ?? null;

  const invalidateSteps = () =>
    qc.invalidateQueries({ queryKey: ["task-steps"] });
  const addStepM = useMutation({
    mutationFn: createStep,
    onSuccess: invalidateSteps,
  });
  const deleteStepM = useMutation({
    mutationFn: removeStep,
    onSuccess: invalidateSteps,
  });

  async function submitStep() {
    const body = stepDraft.trim();
    if (!body) return;
    setStepDraft("");
    const row = await addStepM.mutateAsync({ data: { task_id: task.id, body } });
    toast("Step logged", {
      duration: 4000,
      action: {
        label: "Undo",
        onClick: async () => {
          await deleteStepM.mutateAsync({ data: { id: row.id } });
        },
      },
    });
  }

  const updateM = useMutation({
    mutationFn: update,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const deleteM = useMutation({
    mutationFn: del,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const nudgeM = useMutation({
    mutationFn: nudge,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const assignee =
    contacts.find((c) => c.id === task.assigned_to)?.name ??
    task.assigned_to_name;

  const isUrgent = task.priority === "Urgent";

  async function setStatusTo(next: TaskStatus) {
    setStatus(next);
    await updateM.mutateAsync({ data: { id: task.id, status: next } });
  }

  async function toggleDone() {
    setBurst(true);
    setTimeout(() => setBurst(false), 700);
    setCompleting(true);
    setTimeout(async () => {
      await updateM.mutateAsync({ data: { id: task.id, status: "Complete" } });
      toast("Nicely done — one less thing to worry about", {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await updateM.mutateAsync({
              data: { id: task.id, status: "Not Started" },
            });
          },
        },
      });
    }, 500);
  }

  async function handleDelete() {
    const snapshot = task;
    await deleteM.mutateAsync({ data: { id: task.id } });
    toast("Removed from your list", {
      duration: 4000,
      action: {
        label: "Undo",
        onClick: async () => {
          const create = (await import("@/lib/tasks.functions")).createTask;
          await create({
            data: {
              title: snapshot.title,
              source: snapshot.source,
              notes: snapshot.notes,
              next_step: snapshot.next_step ?? null,
              category: snapshot.category,
              priority: snapshot.priority,
              assigned_to: snapshot.assigned_to,
              assigned_to_name: snapshot.assigned_to_name,
              due_date: snapshot.due_date,
              due_time: snapshot.due_time,
            },
          });
          qc.invalidateQueries({ queryKey: ["tasks"] });
        },
      },
    });
  }

  async function saveEdits() {
    await updateM.mutateAsync({
      data: {
        id: task.id,
        title: title.trim() || task.title,
        notes: notes || null,
        status,
        category,
        priority,
        assigned_to: contactId,
        assigned_to_name: contactId ? null : freeText.trim() || null,
        due_date: dueDate || null,
        due_time: dueDate ? dueTime || null : null,
      },
    });
    setExpanded(false);
  }

  async function playOriginal() {
    if (!task.voice_note_url) return;
    try {
      const res = await getVoice({ data: { path: task.voice_note_url } });
      const audio = new Audio(res.url);
      void audio.play();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't play audio");
    }
  }

  const waitDays = daysSince(task.last_followup_at ?? task.created_at);
  const followupOverdue =
    !!task.next_followup_reminder_at &&
    new Date(task.next_followup_reminder_at).getTime() < Date.now();
  const nudgeContact = contacts.find((c) => c.id === task.assigned_to) ?? null;

  return (
    <div
      className={cn(
        "group relative overflow-hidden border border-border bg-card transition-colors hover:border-border-strong",
        completing && "animate-complete",
      )}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">

        <div className="relative mt-0.5 shrink-0">
          {burst && <PetalBurst />}
          <button
            type="button"
            onClick={toggleDone}
            aria-label={`Mark ${task.title} complete`}
            className={cn(
              "relative flex h-[18px] w-[18px] items-center justify-center rounded-none border border-border-strong transition-all hover:border-foreground",
              completing && "border-foreground bg-primary animate-ring-pop",
            )}
          >
            <Check
              className={cn(
                "h-3 w-3 text-primary-foreground transition-opacity",
                completing ? "opacity-100" : "opacity-0",
              )}
              strokeWidth={3}
            />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-left"
          >
            <div className="flex items-start gap-1.5">
              {isUrgent && (
                <span
                  aria-label="Urgent"
                  className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 bg-foreground"
                />
              )}
              <div
                className={cn(
                  "min-w-0 break-words text-[14px] leading-snug text-foreground",
                  isUrgent ? "font-bold" : "font-normal",
                )}
              >
                {task.title}
              </div>
            </div>
          </button>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {/* Status badge doubles as the status picker — always editable
                without touching the task body. */}
            <Select
              value={status}
              onValueChange={(v) => void setStatusTo(v as TaskStatus)}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger
                    aria-label="Change status"
                    className={cn(
                      "h-[18px] w-auto gap-1 px-1.5 py-0 shadow-none focus:ring-1 [&>svg:last-child]:h-2.5 [&>svg:last-child]:w-2.5 [&>svg:last-child]:opacity-60",
                      STATUS_BADGE[status],
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {STATUS_ICON[status]}
                      {status}
                    </span>
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent>{STATUS_HELP[status]}</TooltipContent>
              </Tooltip>
              <SelectContent align="start">
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="inline-flex items-center gap-2">
                      {STATUS_ICON[s]}
                      {s}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {task.category && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 font-semibold",
                  CATEGORY_PILL[task.category],
                )}
              >
                {task.category}
              </span>
            )}
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">
                <AlertCircle className="h-3 w-3" strokeWidth={2} />
                Past its date
              </span>
            )}
            {task.priority === "Important" && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 font-semibold pill-cat-gifts">
                Important
              </span>
            )}
            {task.due_date && (
              <span className="inline-flex items-center gap-1">
                <CalIcon className="h-3 w-3" strokeWidth={2} />
                {task.due_date}
                {task.due_time && (
                  <>
                    <Clock className="ml-1 h-3 w-3" strokeWidth={2} />
                    {formatTime(task.due_time)}
                  </>
                )}
              </span>
            )}
            {assignee && <span className="truncate">→ {assignee}</span>}
            {showWaitingBadge && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                  waitDays >= 3
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "bg-secondary text-muted-foreground",
                  followupOverdue &&
                    "ring-2 ring-ring/60 ring-offset-1 ring-offset-card",
                  nudgeFlash && "animate-flash",
                )}
                title={
                  followupOverdue
                    ? "You asked to be reminded about this — that time has passed"
                    : undefined
                }
              >
                {waitingLabel(waitDays)}
              </span>
            )}
          </div>

          {/* Most recent entry from the step log, visible without expanding. */}
          {latestStep ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-1 flex items-start gap-1 text-left text-[12px] text-foreground/80 underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              <ArrowRight className="mt-[3px] h-3 w-3 shrink-0" strokeWidth={2} />
              <span className="min-w-0 break-words">
                <span className="font-medium">Next:</span> {latestStep.body}
              </span>
              <span className="mt-[1px] shrink-0 text-[11px] text-muted-foreground">+</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              + Add step
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 translate-x-2 opacity-0 transition-all duration-200 focus-within:translate-x-0 focus-within:opacity-100 group-hover:translate-x-0 group-hover:opacity-100">
          {showWaitingBadge && (
            <button
              type="button"
              onClick={() => {
                setRemindDays(2);
                setNudgeStep(
                  nudgeContact?.phone || nudgeContact?.email
                    ? "contact"
                    : "status",
                );
              }}
              title="Reach out, then update the status"
              aria-label="Follow up and set a reminder"
              className="flex h-7 w-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
            >
              <BellRing className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            title="Remove this task"
            aria-label={`Delete ${task.title}`}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-border bg-surface px-3 pb-4">
          <div className="pt-3">
            <Label htmlFor={`t-${task.id}`} className="text-xs">
              Title
            </Label>
            <Input
              id={`t-${task.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="mt-1"
            />
          </div>
          <div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Label htmlFor={`ns-${task.id}`} className="text-xs">
                  Step log
                </Label>
              </TooltipTrigger>
              <TooltipContent>
                A running record of what's happened — newest first. Separate
                from notes and from the task's status.
              </TooltipContent>
            </Tooltip>
            <div className="mt-1 flex gap-2">
              <Input
                id={`ns-${task.id}`}
                value={stepDraft}
                maxLength={300}
                placeholder="e.g. Called the caterer, waiting on a quote"
                onChange={(e) => setStepDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submitStep();
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void submitStep()}
                disabled={!stepDraft.trim() || addStepM.isPending}
              >
                Add step
              </Button>
            </div>

            {steps.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <StepEntry
                  body={steps[0].body}
                  at={steps[0].created_at}
                  onDelete={() =>
                    void deleteStepM.mutateAsync({ data: { id: steps[0].id } })
                  }
                  latest
                />
                {steps.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setHistoryOpen((v) => !v)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      {historyOpen ? (
                        <ChevronDown className="h-3 w-3" strokeWidth={2} />
                      ) : (
                        <ChevronRight className="h-3 w-3" strokeWidth={2} />
                      )}
                      {historyOpen
                        ? "Hide earlier steps"
                        : `${steps.length - 1} earlier step${steps.length > 2 ? "s" : ""}`}
                    </button>
                    {historyOpen &&
                      steps.slice(1).map((st) => (
                        <StepEntry
                          key={st.id}
                          body={st.body}
                          at={st.created_at}
                          onDelete={() =>
                            void deleteStepM.mutateAsync({
                              data: { id: st.id },
                            })
                          }
                        />
                      ))}
                  </>
                )}
              </div>
            )}
          </div>
          <div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Label htmlFor={`n-${task.id}`} className="text-xs">
                  Notes
                </Label>
              </TooltipTrigger>
              <TooltipContent>
                Background and context you may need later.
              </TooltipContent>
            </Tooltip>
            <Textarea
              id={`n-${task.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Category</Label>
              <Select
                value={category ?? "__none"}
                onValueChange={(v) =>
                  setCategory(v === "__none" ? null : (v as Category))
                }
              >
                <SelectTrigger className="mt-1 h-10">
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
              <Label className="text-xs">Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Task["priority"])}
              >
                <SelectTrigger className="mt-1 h-10">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`d-${task.id}`} className="text-xs">
                Due date
              </Label>
              <Input
                id={`d-${task.id}`}
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  if (!e.target.value) setDueTime("");
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`ti-${task.id}`} className="text-xs">
                Time
              </Label>
              <Input
                id={`ti-${task.id}`}
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={!dueDate}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Label className="text-xs">Assigned to</Label>
              </TooltipTrigger>
              <TooltipContent>
                The person actually doing this — leave empty if it's you.
              </TooltipContent>
            </Tooltip>
            <div className="mt-1">
              <AssigneeCombobox
                contacts={contacts}
                contactId={contactId}
                freeText={freeText}
                onChange={({ contactId: id, freeText: t }) => {
                  setContactId(id);
                  setFreeText(t);
                }}
              />
            </div>
          </div>

          {task.status_updated_at && (
            <p className="text-[11px] text-muted-foreground">
              Status last changed{" "}
              {new Date(task.status_updated_at).toLocaleString()}
            </p>
          )}

          {task.source_type === "Voice" && (
            <div className="space-y-2 rounded-md bg-secondary/70 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground/80">
                  From voice note
                </span>
                {task.voice_note_url && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1"
                    onClick={playOriginal}
                  >
                    <PlayCircle className="h-4 w-4" />
                    Play original
                  </Button>
                )}
              </div>
              {task.raw_transcript && (
                <p className="italic">"{task.raw_transcript}"</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(false)}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={saveEdits}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={nudgeStep !== null}
        onOpenChange={(o) => {
          if (!o) setNudgeStep(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {nudgeStep === "contact" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">
                  Reach out to {nudgeContact?.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-1">
                {nudgeContact?.phone ? (
                  <>
                    <Button
                      asChild
                      className="h-11 w-full justify-start"
                      variant="secondary"
                      onClick={() => setNudgeStep("status")}
                    >
                      <a href={`tel:${nudgeContact.phone}`}>
                        <Phone className="mr-2 h-4 w-4" />
                        Call {nudgeContact.phone}
                      </a>
                    </Button>
                    <Button
                      asChild
                      className="h-11 w-full justify-start"
                      variant="secondary"
                      onClick={() => setNudgeStep("status")}
                    >
                      <a href={`sms:${nudgeContact.phone}`}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Text {nudgeContact.phone}
                      </a>
                    </Button>
                  </>
                ) : nudgeContact?.email ? (
                  <Button
                    asChild
                    className="h-11 w-full justify-start"
                    variant="secondary"
                    onClick={() => setNudgeStep("status")}
                  >
                    <a href={`mailto:${nudgeContact.email}`}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Email {nudgeContact.email}
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No phone number saved for this contact.{" "}
                    <a
                      href={`/contacts/${nudgeContact?.id ?? ""}`}
                      className="underline"
                    >
                      Add phone number
                    </a>
                  </p>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="ghost" onClick={() => setNudgeStep("status")}>
                  Skip
                </Button>
              </DialogFooter>
            </>
          )}

          {nudgeStep === "status" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">
                  Update the status?
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-1">
                <p className="text-sm text-muted-foreground">
                  You just reached out — where does this stand now?
                </p>
                {(
                  ["In Progress", "Waiting on Someone", "Complete"] as TaskStatus[]
                ).map((s) => (
                  <Button
                    key={s}
                    variant="secondary"
                    className="h-10 w-full justify-start"
                    onClick={async () => {
                      await setStatusTo(s);
                      setNudgeStep(s === "Complete" ? null : "reminder");
                      if (s === "Complete") toast.success("Marked Complete");
                    }}
                  >
                    <span className="mr-2 inline-flex">{STATUS_ICON[s]}</span>
                    Mark as {s}
                  </Button>
                ))}
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="ghost" onClick={() => setNudgeStep("reminder")}>
                  Leave as is
                </Button>
              </DialogFooter>
            </>
          )}

          {nudgeStep === "reminder" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">
                  Remind you again?
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <p className="text-sm text-muted-foreground">
                  If there's no response, we'll flag this task again.
                </p>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`rd-${task.id}`} className="text-sm">
                    In
                  </Label>
                  <Input
                    id={`rd-${task.id}`}
                    type="number"
                    min={1}
                    max={60}
                    value={remindDays}
                    onChange={(e) =>
                      setRemindDays(
                        Math.max(1, Math.min(60, Number(e.target.value) || 1)),
                      )
                    }
                    className="h-10 w-20"
                  />
                  <span className="text-sm">days</span>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="ghost"
                  onClick={async () => {
                    setNudgeStep(null);
                    setNudgeFlash(true);
                    setTimeout(() => setNudgeFlash(false), 700);
                    await nudgeM.mutateAsync({
                      data: { id: task.id, remind_in_days: null },
                    });
                  }}
                >
                  Skip reminder
                </Button>
                <Button
                  onClick={async () => {
                    setNudgeStep(null);
                    setNudgeFlash(true);
                    setTimeout(() => setNudgeFlash(false), 700);
                    await nudgeM.mutateAsync({
                      data: { id: task.id, remind_in_days: remindDays },
                    });
                  }}
                >
                  Remind in {remindDays}d
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete this task?
            </AlertDialogTitle>
            <AlertDialogDescription>
              "{task.title}" will be removed. You'll have a moment to undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmDelete(false);
                await handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** One timestamped entry in a task's step log. */
function StepEntry({
  body,
  at,
  onDelete,
  latest,
}: {
  body: string;
  at: string;
  onDelete: () => void;
  latest?: boolean;
}) {
  return (
    <div
      className={cn(
        "group/step flex items-start gap-2 rounded-lg border border-border px-2 py-1.5",
        latest ? "bg-card" : "bg-surface",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="break-words text-[12px] leading-snug text-foreground">
          {body}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {new Date(at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete this step"
        className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/step:opacity-100"
      >
        <X className="h-3 w-3" strokeWidth={2} />
      </button>
    </div>
  );
}
