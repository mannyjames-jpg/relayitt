CREATE TABLE public.exec_info_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section text NOT NULL,
  field_key text NOT NULL,
  value_plain text NULL,
  value_cipher text NULL,
  is_secret boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, section, field_key),
  CONSTRAINT exec_info_fields_secret_storage CHECK (
    (is_secret AND value_plain IS NULL) OR (NOT is_secret AND value_cipher IS NULL)
  )
);
CREATE TABLE public.exec_info_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('child','date','airline','hotel','other','pro')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_cipher text NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.exec_info_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('unlock','lock','reveal','edit','mfa_enrolled','mfa_removed')),
  label text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exec_info_audit_user_created_idx ON public.exec_info_audit (user_id, created_at DESC);
CREATE TABLE public.exec_info_session (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_active_at timestamptz NOT NULL
);

REVOKE ALL ON public.exec_info_fields, public.exec_info_rows, public.exec_info_audit, public.exec_info_session FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exec_info_fields TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exec_info_rows TO authenticated;
GRANT SELECT, INSERT ON public.exec_info_audit TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exec_info_session TO authenticated;
GRANT ALL ON public.exec_info_fields, public.exec_info_rows, public.exec_info_audit, public.exec_info_session TO service_role;

ALTER TABLE public.exec_info_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exec_info_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exec_info_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exec_info_session ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own exec fields select" ON public.exec_info_fields FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own exec fields insert" ON public.exec_info_fields FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own exec fields update" ON public.exec_info_fields FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own exec fields delete" ON public.exec_info_fields FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Own exec rows select" ON public.exec_info_rows FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own exec rows insert" ON public.exec_info_rows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own exec rows update" ON public.exec_info_rows FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own exec rows delete" ON public.exec_info_rows FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Own exec audit select" ON public.exec_info_audit FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own exec audit insert" ON public.exec_info_audit FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Own exec session select" ON public.exec_info_session FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own exec session insert" ON public.exec_info_session FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own exec session update" ON public.exec_info_session FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.exec_info_touch_updated()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER exec_info_fields_touch_updated_trg BEFORE UPDATE ON public.exec_info_fields FOR EACH ROW EXECUTE FUNCTION public.exec_info_touch_updated();
CREATE TRIGGER exec_info_rows_touch_updated_trg BEFORE UPDATE ON public.exec_info_rows FOR EACH ROW EXECUTE FUNCTION public.exec_info_touch_updated();