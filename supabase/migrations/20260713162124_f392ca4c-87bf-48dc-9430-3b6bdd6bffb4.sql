
-- New enums for task categorization, priority, and origin
CREATE TYPE public.task_category AS ENUM (
  'Travel','Household','Scheduling','Errands','Gifts/Events','Finance','Vendors','Other'
);
CREATE TYPE public.task_priority AS ENUM ('Normal','Important','Urgent');
CREATE TYPE public.task_source_type AS ENUM ('Typed','Voice');

ALTER TABLE public.tasks
  ADD COLUMN category public.task_category,
  ADD COLUMN priority public.task_priority NOT NULL DEFAULT 'Normal',
  ADD COLUMN delegated_to_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN source_type public.task_source_type NOT NULL DEFAULT 'Typed',
  ADD COLUMN voice_note_url TEXT,
  ADD COLUMN raw_transcript TEXT;

CREATE INDEX tasks_delegated_to_idx ON public.tasks(user_id, delegated_to_contact_id);
CREATE INDEX tasks_priority_idx ON public.tasks(user_id, priority);
