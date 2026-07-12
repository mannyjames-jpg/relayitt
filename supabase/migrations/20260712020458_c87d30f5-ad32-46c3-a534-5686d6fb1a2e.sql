
-- Enums
CREATE TYPE public.task_source AS ENUM ('From Boss', 'Delegated by Me', 'Personal Reminder');
CREATE TYPE public.task_status AS ENUM ('Not Started', 'In Progress', 'Waiting on Someone', 'Done');

-- Contacts
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) <= 100 AND char_length(btrim(name)) > 0),
  role TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contacts_user_id_idx ON public.contacts(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contacts" ON public.contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 200 AND char_length(btrim(title)) > 0),
  notes TEXT,
  source public.task_source NOT NULL DEFAULT 'Personal Reminder',
  status public.task_status NOT NULL DEFAULT 'Not Started',
  assigned_to UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_to_name TEXT,
  due_date DATE,
  due_time TIME,
  last_followup_at TIMESTAMPTZ,
  calendar_event_id TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT time_requires_date CHECK (due_time IS NULL OR due_date IS NOT NULL)
);
CREATE INDEX tasks_user_id_idx ON public.tasks(user_id);
CREATE INDEX tasks_status_idx ON public.tasks(user_id, status);
CREATE INDEX tasks_due_date_idx ON public.tasks(user_id, due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger: keep updated_at fresh + auto-manage completed_at
CREATE OR REPLACE FUNCTION public.tasks_touch_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'Done' AND (OLD.status IS DISTINCT FROM 'Done') THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'Done' AND OLD.status = 'Done' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_touch_updated_trg
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_touch_updated();

CREATE OR REPLACE FUNCTION public.tasks_set_completed_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Done' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_set_completed_on_insert_trg
BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_set_completed_on_insert();

-- Google Calendar OAuth tokens (server-only)
CREATE TABLE public.google_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.google_tokens TO service_role;
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated: tokens are only accessible via service_role.

-- View helper for checking if google is connected (safe columns only)
CREATE OR REPLACE FUNCTION public.is_google_connected()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.google_tokens WHERE user_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.is_google_connected() TO authenticated;
