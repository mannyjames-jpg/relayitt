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
});

type Scored = { fit_score: number; summary: string };

export const scoreApplicants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        jobId: uuid,
        applicants: z.array(applicantSchema).min(1).max(200),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const { data: job, error: jobErr } = await supabase
      .from("job_postings")
      .select("title,must_haves,nice_to_haves")
      .eq("id", data.jobId)
      .eq("user_id", userId)
      .single();
    if (jobErr) throw new Error(jobErr.message);

    const system = `You screen job applicants for a hiring manager.
Role: ${job.title}
Must-haves: ${job.must_haves || "(none given)"}
Nice-to-haves: ${job.nice_to_haves || "(none given)"}

For EACH applicant, judge fit from their name, headline/current title and location only.
Score 0-100 (100 = clearly meets all must-haves, 0 = clearly irrelevant). Be decisive and spread scores out.
Write one short sentence (max 20 words) explaining the score. Never invent facts not implied by the headline.
Return one result per applicant, in the same order, via the emit_scores tool.`;

    async function scoreBatch(batch: z.infer<typeof applicantSchema>[]) {
      const res = await fetch(`${GATEWAY}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.5-flash",
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: batch
                .map(
                  (a, i) =>
                    `${i + 1}. ${a.name} — ${a.headline || "no headline"} — ${a.location || "location unknown"}`,
                )
                .join("\n"),
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "emit_scores",
                description: "Emit a fit score and summary per applicant.",
                parameters: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          fit_score: { type: "integer" },
                          summary: { type: "string" },
                        },
                        required: ["fit_score", "summary"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["results"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "emit_scores" },
          },
        }),
      });

      if (res.status === 429)
        throw new Error("AI rate limit reached — try again in a moment.");
      if (res.status === 402)
        throw new Error("AI credits exhausted — add credits to continue.");
      if (!res.ok) throw new Error(`Scoring failed (${res.status})`);

      const json = (await res.json()) as {
        choices?: {
          message?: {
            tool_calls?: { function?: { arguments?: string } }[];
          };
        }[];
      };
      const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) throw new Error("AI returned no scores");
      const parsed = JSON.parse(args) as { results?: Scored[] };
      return parsed.results ?? [];
    }

    const scored: Scored[] = [];
    const SIZE = 20;
    for (let i = 0; i < data.applicants.length; i += SIZE) {
      const batch = data.applicants.slice(i, i + SIZE);
      const results = await scoreBatch(batch);
      for (let j = 0; j < batch.length; j++) {
        const r = results[j];
        scored.push({
          fit_score: Math.max(0, Math.min(100, Math.round(r?.fit_score ?? 0))),
          summary: r?.summary ?? "No summary available.",
        });
      }
    }

    // Replace any previous run for this job.
    await supabase
      .from("applicant_reviews")
      .delete()
      .eq("user_id", userId)
      .eq("job_id", data.jobId);

    const rows = data.applicants.map((a, i) => ({
      user_id: userId,
      job_id: data.jobId,
      name: a.name,
      headline: a.headline || null,
      location: a.location || null,
      applied_at: a.applied_at || null,
      profile_url: a.profile_url || null,
      fit_score: scored[i]?.fit_score ?? 0,
      summary: scored[i]?.summary ?? null,
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
