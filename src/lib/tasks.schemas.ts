import { z } from "zod";

export const uuid = z.string().uuid();
export const sourceEnum = z.enum(["From Boss", "Delegated by Me", "Personal Reminder"]);
export const statusEnum = z.enum([
  "Not Started",
  "In Progress",
  "Waiting on Someone",
  "Complete",
]);
export const categoryEnum = z.enum([
  "Travel",
  "Household",
  "Scheduling",
  "Errands",
  "Gifts/Events",
  "Finance",
  "Vendors",
  "Other",
]);
export const priorityEnum = z.enum(["Normal", "Important", "Urgent"]);
export const sourceTypeEnum = z.enum(["Typed", "Voice"]);
export const recurrenceTypeEnum = z.enum(["none", "daily", "weekly", "monthly"]);

const recurrenceFields = {
  recurrence_type: recurrenceTypeEnum.optional(),
  recurrence_interval: z.number().int().min(1).max(365).optional(),
  recurrence_days: z.array(z.string().max(3)).max(7).optional(),
  recurrence_end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
};

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();
const timeStr = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/)
  .nullable()
  .optional();

export const createTaskInput = z.object({
  title: z.string().trim().min(1).max(200),
  source: sourceEnum.default("Personal Reminder"),
  notes: z.string().optional().nullable(),
  next_step: z.string().max(200).nullable().optional(),
  category: categoryEnum.nullable().optional(),
  priority: priorityEnum.optional(),
  assigned_to: uuid.nullable().optional(),
  assigned_to_name: z.string().max(100).nullable().optional(),
  due_date: dateStr,
  due_time: timeStr,
  source_type: sourceTypeEnum.optional(),
  voice_note_url: z.string().max(500).nullable().optional(),
  raw_transcript: z.string().nullable().optional(),
  ...recurrenceFields,
});
export type CreateTaskInput = z.infer<typeof createTaskInput>;

export const updateTaskFields = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().nullable().optional(),
  next_step: z.string().max(200).nullable().optional(),
  source: sourceEnum.optional(),
  status: statusEnum.optional(),
  category: categoryEnum.nullable().optional(),
  priority: priorityEnum.optional(),
  assigned_to: uuid.nullable().optional(),
  assigned_to_name: z.string().max(100).nullable().optional(),
  due_date: dateStr,
  due_time: timeStr,
  ...recurrenceFields,
});
export const updateTaskInput = updateTaskFields.extend({ id: uuid });
export type UpdateTaskInput = z.infer<typeof updateTaskInput>;

export const deleteScopeEnum = z.enum(["one", "series"]);
export const deleteTaskInput = z.object({ id: uuid, scope: deleteScopeEnum.optional() });
export type DeleteTaskInput = z.infer<typeof deleteTaskInput>;

export const nudgeFields = z.object({
  // null = clear reminder / skip; number = days from now
  remind_in_days: z.number().int().min(1).max(60).nullable().optional(),
});
export const nudgeTaskInput = nudgeFields.extend({ id: uuid });
export type NudgeTaskInput = z.infer<typeof nudgeTaskInput>;

export const contactInput = z.object({
  name: z.string().trim().min(1).max(100),
  role: z.string().max(100).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  notes: z.string().nullable().optional(),
});
export type ContactInput = z.infer<typeof contactInput>;
export const contactPatchInput = contactInput.partial();
export type ContactPatchInput = z.infer<typeof contactPatchInput>;
