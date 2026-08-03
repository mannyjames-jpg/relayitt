CREATE TYPE public.task_recurrence_type AS ENUM ('none','daily','weekly','monthly');

ALTER TABLE public.tasks
  ADD COLUMN recurrence_type public.task_recurrence_type NOT NULL DEFAULT 'none',
  ADD COLUMN recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN recurrence_days text[] NOT NULL DEFAULT '{}',
  ADD COLUMN recurrence_end_date date,
  ADD COLUMN parent_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_parent_task_id_idx ON public.tasks(parent_task_id);