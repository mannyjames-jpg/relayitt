
DROP FUNCTION IF EXISTS public.is_google_connected();

CREATE POLICY "Deny all access to google_tokens" ON public.google_tokens
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

REVOKE ALL ON public.google_tokens FROM authenticated, anon;
