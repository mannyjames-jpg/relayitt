/** Minimal RFC4180-ish CSV parser for client-side LinkedIn applicant exports. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

export type ParsedApplicant = {
  name: string;
  headline: string | null;
  location: string | null;
  applied_at: string | null;
  profile_url: string | null;
};

function pick(
  header: string[],
  row: string[],
  ...candidates: string[]
): string | null {
  for (const c of candidates) {
    const idx = header.indexOf(c);
    if (idx !== -1) {
      const v = (row[idx] ?? "").trim();
      if (v) return v;
    }
  }
  return null;
}

/** Maps a LinkedIn applicant export into our applicant shape. */
export function parseApplicantsCsv(text: string): ParsedApplicant[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());

  return rows.slice(1).flatMap((row) => {
    const first = pick(header, row, "first name", "firstname") ?? "";
    const last = pick(header, row, "last name", "lastname") ?? "";
    const full = pick(header, row, "name", "full name") ?? "";
    const name = (full || `${first} ${last}`).trim();
    if (!name) return [];
    return [
      {
        name,
        headline:
          pick(header, row, "job title", "headline", "title", "current title") ??
          pick(header, row, "company") ??
          null,
        location: pick(header, row, "location", "city", "region"),
        applied_at: pick(header, row, "applied on", "applied at", "date applied"),
        profile_url: pick(
          header,
          row,
          "linkedin profile url",
          "profile url",
          "linkedin profile",
          "profile",
        ),
      },
    ];
  });
}
