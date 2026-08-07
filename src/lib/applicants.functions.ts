import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const uuid = z.string().uuid();

export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("job_postings")
      .select("id,title,must_haves,nice_to_haves,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        must_haves: z.string().max(4000).nullable().optional(),
        nice_to_haves: z.string().max(4000).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("job_postings")
      .insert({
        user_id: userId,
        title: data.title.trim(),
        must_haves: data.must_haves?.trim() || null,
        nice_to_haves: data.nice_to_haves?.trim() || null,
      })
      .select("id,title,must_haves,nice_to_haves,created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ jobId: uuid }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("applicant_reviews")
      .select(
        "id,job_id,name,headline,location,applied_at,profile_url,fit_score,summary,decision,created_at",
      )
      .eq("user_id", userId)
      .eq("job_id", data.jobId)
      .order("fit_score", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: uuid,
        decision: z.enum(["Keep", "Maybe", "Pass", "Undecided"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("applicant_reviews")
      .update({ decision: data.decision })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const applicantSchema = z.object({
  name: z.string().max(200),
  headline: z.string().max(300).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  applied_at: z.string().max(100).nullable().optional(),
  profile_url: z.string().max(500).nullable().optional(),
  fit_score: z.number().int().min(0).max(100),
  summary: z.string().max(1000).nullable().optional(),
});

/** Persists a locally scored batch of applicants, replacing any previous run. */
export const saveApplicantScores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        jobId: uuid,
        applicants: z.array(applicantSchema).min(1).max(500),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await supabase
      .from("applicant_reviews")
      .delete()
      .eq("user_id", userId)
      .eq("job_id", data.jobId);

    const rows = data.applicants.map((a) => ({
      user_id: userId,
      job_id: data.jobId,
      name: a.name,
      headline: a.headline || null,
      location: a.location || null,
      applied_at: a.applied_at || null,
      profile_url: a.profile_url || null,
      fit_score: a.fit_score,
      summary: a.summary || null,
      decision: "Undecided" as const,
    }));

    const { data: inserted, error } = await supabase
      .from("applicant_reviews")
      .insert(rows)
      .select(
        "id,job_id,name,headline,location,applied_at,profile_url,fit_score,summary,decision,created_at",
      );
    if (error) throw new Error(error.message);
    return inserted ?? [];
  });

