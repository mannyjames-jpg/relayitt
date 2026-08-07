CREATE TYPE public.applicant_decision AS ENUM ('Keep','Pass','Maybe','Undecided');

CREATE TABLE public.job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  must_haves text,
  nice_to_haves text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_postings TO authenticated;
GRANT ALL ON public.job_postings TO service_role;
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own job postings" ON public.job_postings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.applicant_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  name text,
  headline text,
  location text,
  applied_at text,
  profile_url text,
  fit_score integer,
  summary text,
  decision public.applicant_decision NOT NULL DEFAULT 'Undecided',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX applicant_reviews_job_id_idx ON public.applicant_reviews(job_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicant_reviews TO authenticated;
GRANT ALL ON public.applicant_reviews TO service_role;
ALTER TABLE public.applicant_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own applicant reviews" ON public.applicant_reviews
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);