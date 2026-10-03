DROP POLICY IF EXISTS "Own exec fields select" ON public.exec_info_fields;
DROP POLICY IF EXISTS "Own exec fields insert" ON public.exec_info_fields;
DROP POLICY IF EXISTS "Own exec fields update" ON public.exec_info_fields;
DROP POLICY IF EXISTS "Own exec fields delete" ON public.exec_info_fields;
DROP POLICY IF EXISTS "Own exec rows select" ON public.exec_info_rows;
DROP POLICY IF EXISTS "Own exec rows insert" ON public.exec_info_rows;
DROP POLICY IF EXISTS "Own exec rows update" ON public.exec_info_rows;
DROP POLICY IF EXISTS "Own exec rows delete" ON public.exec_info_rows;
DROP POLICY IF EXISTS "Own exec session select" ON public.exec_info_session;
DROP POLICY IF EXISTS "Own exec session insert" ON public.exec_info_session;
DROP POLICY IF EXISTS "Own exec session update" ON public.exec_info_session;

CREATE POLICY "Own exec fields select aal2" ON public.exec_info_fields FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Own exec fields insert aal2" ON public.exec_info_fields FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Own exec fields update aal2" ON public.exec_info_fields FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2')
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Own exec fields delete aal2" ON public.exec_info_fields FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "Own exec rows select aal2" ON public.exec_info_rows FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Own exec rows insert aal2" ON public.exec_info_rows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Own exec rows update aal2" ON public.exec_info_rows FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2')
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Own exec rows delete aal2" ON public.exec_info_rows FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2');

CREATE POLICY "Own exec session select aal2" ON public.exec_info_session FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Own exec session insert aal2" ON public.exec_info_session FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Own exec session update aal2" ON public.exec_info_session FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2')
  WITH CHECK (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2');
CREATE POLICY "Own exec session delete aal2" ON public.exec_info_session FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND (auth.jwt() ->> 'aal') = 'aal2');

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.exec_info_fields, public.exec_info_rows, public.exec_info_audit, public.exec_info_session FROM authenticated, anon, public;
REVOKE UPDATE, DELETE ON public.exec_info_audit FROM authenticated, anon, public;