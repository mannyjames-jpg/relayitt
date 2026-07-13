
CREATE POLICY "Users read own voice notes" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'voice-notes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own voice notes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-notes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own voice notes" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'voice-notes' AND (storage.foldername(name))[1] = auth.uid()::text);
