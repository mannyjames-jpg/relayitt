import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BellRing,
  Calendar as CalIcon,
  Check,
  Circle,
  Clock,
  MessageCircleQuestion,
  Play,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { deleteTask, nudgeTask, updateTask } from "@/lib/tasks.functions";
import { formatTime, daysSince } from "@/lib/date-utils";
import type { ContactOption } from "./AssigneeCombobox";
import { AssigneeCombobox } from "./AssigneeCombobox";

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  source: "From Boss" | "Delegated by Me" | "Personal Reminder";
  status: "Not Started" | "In Progress" | "Waiting on Someone" | "Done";
  assigned_to: string | null;
  assigned_to_name: string | null;
  due_date: string | null;
  due_time: string | null;
  last_followup_at: string | null;
  created_at: string;
};

const STATUS_ICON: Record<Task["status"], React.ReactNode> = {
  "Not Started": <Circle className="h-3.5 w-3.5" />,
  "In Progress": <Play className="h-3.5 w-3.5" />,
  "Waiting on Someone": <MessageCircleQuestion className="h-3.5 w-3.5" />,
  Done: <Check className="h-3.5 w-3.5" />,
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

  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [nudgeFlash, setNudgeFlash] = useState(false);

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [status, setStatus] = useState<Task["status"]>(task.status);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [dueTime, setDueTime] = useState(task.due_time?.slice(0, 5) ?? "");
  const [contactId, setContactId] = useState<string | null>(task.assigned_to);
  const [freeText, setFreeText] = useState(task.assigned_to_name ?? "");

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setStatus(task.status);
    setDueDate(task.due_date ?? "");
    setDueTime(task.due_time?.slice(0, 5) ?? "");
    setContactId(task.assigned_to);
    setFreeText(task.assigned_to_name ?? "");
  }, [task]);

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

  async function toggleDone() {
    setCompleting(true);
    setTimeout(async () => {
      await updateM.mutateAsync({ data: { id: task.id, status: "Done" } });
      toast("Task completed", {
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
    toast("Task deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          const create = (await import("@/lib/tasks.functions")).createTask;
          await create({
            data: {
              title: snapshot.title,
              source: snapshot.source,
              notes: snapshot.notes,
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
        assigned_to: contactId,
        assigned_to_name: contactId ? null : freeText.trim() || null,
        due_date: dueDate || null,
        due_time: dueDate ? dueTime || null : null,
      },
    });
    setExpanded(false);
  }

  const waitDays = daysSince(task.last_followup_at ?? task.created_at);

  return (
    <div
      className={cn(
        "border-b border-border last:border-b-0",
        completing && "animate-complete",
        overdue && "border-l-2 border-l-primary",
      )}
    >
      <div className="flex items-start gap-3 px-3 py-3 min-h-[56px]">
        <button
          type="button"
          onClick={toggleDone}
          aria-label={`Mark ${task.title} done`}
          className="mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 border-muted-foreground/40 hover:border-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
        >
          {status === "Done" && <Check className="h-4 w-4 text-primary" />}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left min-w-0"
        >
          <div className="text-[15px] leading-snug text-foreground">
            {task.title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              {STATUS_ICON[status]}
              <span>{status}</span>
            </span>
            {task.due_date && (
              <span className="inline-flex items-center gap-1">
                <CalIcon className="h-3.5 w-3.5" />
                {task.due_date}
                {task.due_time && (
                  <>
                    <Clock className="ml-1 h-3.5 w-3.5" />
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
                    ? "bg-primary/15 text-primary font-medium"
                    : "bg-secondary text-muted-foreground",
                  nudgeFlash && "animate-flash",
                )}
              >
                waiting {waitDays}d
              </span>
            )}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <Select
            value={status}
            onValueChange={async (v) => {
              const next = v as Task["status"];
              setStatus(next);
              await updateM.mutateAsync({ data: { id: task.id, status: next } });
            }}
          >
            <SelectTrigger
              className="h-8 w-8 border-0 p-0 [&>svg:last-child]:hidden"
              aria-label="Change status"
            >
              <span className="sr-only">{status}</span>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="Not Started">Not Started</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Waiting on Someone">Waiting on Someone</SelectItem>
              <SelectItem value="Done">Done</SelectItem>
            </SelectContent>
          </Select>

          {showWaitingBadge && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
              onClick={async () => {
                setNudgeFlash(true);
                setTimeout(() => setNudgeFlash(false), 700);
                await nudgeM.mutateAsync({ data: { id: task.id } });
              }}
              aria-label="Mark nudge sent"
            >
              <BellRing className="h-3.5 w-3.5 mr-1" />
              Nudge
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-4 space-y-3 bg-secondary/40 border-t border-border">
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
            <Label htmlFor={`n-${task.id}`} className="text-xs">
              Notes
            </Label>
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
            <Label className="text-xs">Assigned to</Label>
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
          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-1" />
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
    </div>
  );
}
