-- 1. Rename Done -> Complete
ALTER TYPE public.task_status RENAME VALUE 'Done' TO 'Complete';

-- 2. New task columns
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS status_updated_at timestamp with time zone NOT NULL DEFAULT now();

-- 3. Update trigger functions to the new status value + track status changes
CREATE OR REPLACE FUNCTION public.tasks_touch_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at := now();
  END IF;
  IF NEW.status = 'Complete' AND (OLD.status IS DISTINCT FROM 'Complete') THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'Complete' AND OLD.status = 'Complete' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tasks_set_completed_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'Complete' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  NEW.status_updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tasks_touch_updated_trg ON public.tasks;
CREATE TRIGGER tasks_touch_updated_trg
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_touch_updated();

DROP TRIGGER IF EXISTS tasks_set_completed_on_insert_trg ON public.tasks;
CREATE TRIGGER tasks_set_completed_on_insert_trg
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_set_completed_on_insert();

-- 4. Profiles (display name + font preference)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY,
  display_name text,
  font_choice text NOT NULL DEFAULT 'system',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile"
  ON public.profiles FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.profiles_touch_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_touch_updated_trg ON public.profiles;
CREATE TRIGGER profiles_touch_updated_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_touch_updated();