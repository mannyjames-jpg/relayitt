import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowUpDown, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  createJob,
  listJobs,
  listReviews,
  saveApplicantScores,
  setDecision,
} from "@/lib/applicants.functions";
import { parseApplicantsCsv, type ParsedApplicant } from "@/lib/applicant-csv";
import { parseKeywords, scoreApplicant } from "@/lib/applicant-scoring";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/applicants")({
  head: () => ({
    meta: [
      { title: "Applicants — Relay" },
      {
        name: "description",
        content:
          "Screen a stack of LinkedIn applicants against your role criteria and keep, pass or flag each one.",
      },
      { property: "og:title", content: "Applicants — Relay" },
      {
        property: "og:description",
        content:
          "Screen a stack of LinkedIn applicants against your role criteria and keep, pass or flag each one.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApplicantsPage,
});

type Decision = "Keep" | "Maybe" | "Pass" | "Undecided";
type SortKey =
  | "name"
  | "headline"
  | "location"
  | "applied_at"
  | "fit_score"
  | "decision";

function ApplicantsPage() {
  const qc = useQueryClient();
  const jobsFn = useServerFn(listJobs);
  const createJobFn = useServerFn(createJob);
  const reviewsFn = useServerFn(listReviews);
  const scoreFn = useServerFn(saveApplicantScores);
  const decideFn = useServerFn(setDecision);

  const [jobId, setJobId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    must_haves: "",
    nice_to_haves: "",
  });
  const [pending, setPending] = useState<ParsedApplicant[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "fit_score",
    desc: true,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ["job-postings"],
    queryFn: () => jobsFn(),
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["applicant-reviews", jobId],
    queryFn: () => reviewsFn({ data: { jobId: jobId! } }),
    enabled: !!jobId,
  });

  const job = jobs.find((j) => j.id === jobId) ?? null;

  const createM = useMutation({
    mutationFn: createJobFn,
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["job-postings"] });
      setJobId(row.id);
      setForm({ title: "", must_haves: "", nice_to_haves: "" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const scoreM = useMutation({
    mutationFn: scoreFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applicant-reviews", jobId] });
      setPending([]);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Applicants scored");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Scoring failed"),
  });

  const decideM = useMutation({
    mutationFn: decideFn,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["applicant-reviews", jobId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const counts = useMemo(() => {
    const c = { Keep: 0, Maybe: 0, Pass: 0, Undecided: 0 };
    for (const r of reviews) c[r.decision as Decision]++;
    return c;
  }, [reviews]);

  const sorted = useMemo(() => {
    const rows = [...reviews];
    rows.sort((a, b) => {
      const av = a[sort.key] ?? "";
      const bv = b[sort.key] ?? "";
      let n: number;
      if (typeof av === "number" || typeof bv === "number")
        n = Number(av) - Number(bv);
      else n = String(av).localeCompare(String(bv));
      return sort.desc ? -n : n;
    });
    return rows;
  }, [reviews, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, desc: !s.desc } : { key, desc: key === "fit_score" },
    );
  }

  async function onFile(file: File) {
    const text = await file.text();
    const parsed = parseApplicantsCsv(text);
    if (parsed.length === 0) {
      toast.error("No applicants found in that file");
      return;
    }
    setPending(parsed.slice(0, 200));
    setFileName(file.name);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
          <Link to="/dashboard" aria-label="Back">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-none">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="font-hero flex-1 text-2xl">Applicants</h1>
          {job && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-none text-xs"
              onClick={() => {
                setJobId(null);
                setPending([]);
                setFileName(null);
              }}
            >
              Change role
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {/* Step 1 — job setup */}
        {!job ? (
          <div className="grid gap-6 md:grid-cols-2">
            <section className="border border-border bg-card p-4">
              <h2 className="font-display mb-3">Pick a role</h2>
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No roles yet — create one on the right.
                </p>
              ) : (
                <div className="space-y-3">
                  <Select onValueChange={(v) => setJobId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an existing role" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Selecting a past role loads its saved results.
                  </p>
                </div>
              )}
            </section>

            <section className="border border-border bg-card p-4">
              <h2 className="font-display mb-3">New role</h2>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!form.title.trim()) return;
                  createM.mutate({
                    data: {
                      title: form.title,
                      must_haves: form.must_haves || null,
                      nice_to_haves: form.nice_to_haves || null,
                    },
                  });
                }}
              >
                <div className="space-y-1">
                  <span className="micro-label">Title</span>
                  <Input
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="Executive Assistant"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <span className="micro-label">Must-haves</span>
                  <Textarea
                    rows={2}
                    value={form.must_haves}
                    onChange={(e) =>
                      setForm({ ...form, must_haves: e.target.value })
                    }
                    placeholder="5+ years supporting C-level, NYC based"
                  />
                </div>
                <div className="space-y-1">
                  <span className="micro-label">Nice-to-haves</span>
                  <Textarea
                    rows={2}
                    value={form.nice_to_haves}
                    onChange={(e) =>
                      setForm({ ...form, nice_to_haves: e.target.value })
                    }
                    placeholder="Startup experience, travel planning"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-9 rounded-none"
                  disabled={createM.isPending}
                >
                  Start Review
                </Button>
              </form>
            </section>
          </div>
        ) : (
          <>
            {/* Step 2 — upload */}
            <section className="border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display">{job.title}</h2>
                  {job.must_haves && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Must: {job.must_haves}
                    </p>
                  )}
                  {job.nice_to_haves && (
                    <p className="text-xs text-muted-foreground">
                      Nice: {job.nice_to_haves}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onFile(f);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-none border border-border text-xs"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="mr-1 h-4 w-4" />
                    {fileName ?? "Upload CSV"}
                  </Button>
                  {pending.length > 0 && (
                    <>
                      <span className="text-xs text-muted-foreground">
                        {pending.length} applicants loaded
                      </span>
                      <Button
                        size="sm"
                        className="h-9 rounded-none"
                        disabled={scoreM.isPending}
                        onClick={() =>
                          scoreM.mutate({
                            data: { jobId: job.id, applicants: pending },
                          })
                        }
                      >
                        {scoreM.isPending && (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        )}
                        Score Applicants
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Expects a LinkedIn applicant export: First Name, Last Name, Job
                Title, LinkedIn Profile URL, Applied On.
              </p>
            </section>

            {/* Step 3 — results */}
            {reviews.length > 0 && (
              <section className="border border-border bg-card">
                <div className="border-b border-border px-4 py-3 text-xs tracking-wide text-muted-foreground">
                  {counts.Keep} to Keep · {counts.Maybe} Maybe · {counts.Pass}{" "}
                  Passed · {counts.Undecided} Undecided
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <Th onClick={() => toggleSort("name")}>Name</Th>
                        <Th onClick={() => toggleSort("headline")}>Headline</Th>
                        <Th onClick={() => toggleSort("location")}>Location</Th>
                        <Th onClick={() => toggleSort("applied_at")}>Applied</Th>
                        <Th onClick={() => toggleSort("fit_score")}>Fit</Th>
                        <th className="px-3 py-2 font-normal">
                          <span className="micro-label">Summary</span>
                        </th>
                        <th className="px-3 py-2 font-normal">
                          <span className="micro-label">Decision</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r) => (
                        <tr key={r.id} className="border-b border-border/60">
                          <td className="px-3 py-2 align-top">
                            {r.profile_url ? (
                              <a
                                href={r.profile_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline underline-offset-2"
                              >
                                {r.name}
                              </a>
                            ) : (
                              r.name
                            )}
                          </td>
                          <td className="px-3 py-2 align-top text-muted-foreground">
                            {r.headline ?? "—"}
                          </td>
                          <td className="px-3 py-2 align-top text-muted-foreground">
                            {r.location ?? "—"}
                          </td>
                          <td className="px-3 py-2 align-top text-muted-foreground">
                            {r.applied_at ?? "—"}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <span
                              className="font-semibold tabular-nums"
                              style={{ color: scoreColor(r.fit_score ?? 0) }}
                            >
                              {r.fit_score ?? 0}
                            </span>
                          </td>
                          <td className="max-w-md px-3 py-2 align-top text-muted-foreground">
                            {r.summary ?? "—"}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <div className="flex gap-1">
                              {(["Keep", "Maybe", "Pass"] as const).map((d) => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() =>
                                    decideM.mutate({
                                      data: {
                                        id: r.id,
                                        decision: r.decision === d ? "Undecided" : d,
                                      },
                                    })
                                  }
                                  className={
                                    r.decision === d
                                      ? "tag-emphasis"
                                      : "tag-quiet"
                                  }
                                >
                                  {d}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {reviews.length === 0 && pending.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No results yet — upload a CSV export to score this role.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 70) return "var(--score-high)";
  if (score >= 40) return "var(--score-mid)";
  return "var(--score-low)";
}

function Th({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-2 font-normal">
      <button
        type="button"
        onClick={onClick}
        className="micro-label inline-flex items-center gap-1"
      >
        {children}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}
