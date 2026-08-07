/** Rule-based, client-side applicant scoring. No external API calls. */

export type ScoreResult = {
  fit_score: number;
  summary: string;
  matched: string[];
  missing: string[];
};

export function parseKeywords(raw?: string | null): string[] {
  return (raw ?? "")
    .split(/[,\n;]/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

function hay(...parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function scoreApplicant(
  applicant: { headline?: string | null; location?: string | null },
  mustHaves: string[],
  niceToHaves: string[],
): ScoreResult {
  const text = hay(applicant.headline);

  const matchedMust = mustHaves.filter((k) => text.includes(k.toLowerCase()));
  const missingMust = mustHaves.filter((k) => !text.includes(k.toLowerCase()));
  const matchedNice = niceToHaves.filter((k) => text.includes(k.toLowerCase()));

  const mustPoints = Math.min(75, matchedMust.length * 15);
  const nicePoints = Math.min(25, matchedNice.length * 5);
  const fit_score = Math.min(100, mustPoints + nicePoints);

  const matched = [...matchedMust, ...matchedNice];
  const parts: string[] = [];
  parts.push(matched.length ? `Matches: ${matched.join(", ")}` : "No keyword matches");
  if (missingMust.length) parts.push(`Missing: ${missingMust.join(", ")}`);

  return { fit_score, summary: parts.join(" — "), matched, missing: missingMust };
}
