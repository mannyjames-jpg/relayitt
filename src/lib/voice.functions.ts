import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const inputSchema = z.object({
  audio_base64: z.string().min(64),
  mime_type: z.string().min(3).max(80),
  // Only pass names + ids so the model can match a spoken name.
  contacts: z
    .array(z.object({ id: z.string().uuid(), name: z.string() }))
    .max(500)
    .default([]),
});

const draftSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(1000).nullable().optional(),
  source: z
    .enum(["From Boss", "Delegated by Me", "Personal Reminder"])
    .default("Personal Reminder"),
  category: z
    .enum([
      "Travel",
      "Household",
      "Scheduling",
      "Errands",
      "Gifts/Events",
      "Finance",
      "Vendors",
      "Other",
    ])
    .nullable()
    .optional(),
  priority: z.enum(["Normal", "Important", "Urgent"]).default("Normal"),
  assigned_contact_id: z.string().uuid().nullable().optional(),
  assigned_to_name: z.string().max(100).nullable().optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  due_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
});

const structuredSchema = z.object({
  drafts: z.array(draftSchema).min(1).max(8),
});

function extToMime(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/m4a": "m4a",
    "audio/ogg": "ogg",
  };
  return map[base] ?? "webm";
}

/**
 * Voice note → transcript + one or more structured draft tasks.
 * The user reviews the drafts before anything is saved. Nothing here writes
 * to the database — that happens client-side after confirmation.
 */
export const transcribeVoiceNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => inputSchema.parse(raw))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    // 1) Transcribe
    const audioBytes = Buffer.from(data.audio_base64, "base64");
    if (audioBytes.byteLength < 1024) {
      throw new Error("Recording was too short — please try again.");
    }
    const ext = extToMime(data.mime_type);
    const audioBlob = new Blob([audioBytes], { type: data.mime_type });

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", audioBlob, `voice.${ext}`);

    const tRes = await fetch(`${GATEWAY}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!tRes.ok) {
      const body = await tRes.text().catch(() => "");
      if (tRes.status === 402) {
        throw new Error(
          "AI credits exhausted. Add credits in workspace billing.",
        );
      }
      if (tRes.status === 429) {
        throw new Error("Voice transcription is rate limited — try again shortly.");
      }
      throw new Error(`Transcription failed (${tRes.status}): ${body.slice(0, 200)}`);
    }
    const tJson = (await tRes.json()) as { text?: string };
    const transcript = (tJson.text ?? "").trim();
    if (!transcript) {
      throw new Error("Couldn't hear anything — please re-record.");
    }

    // 2) Structure into 1+ drafts
    const today = new Date().toISOString().slice(0, 10);
    const contactList =
      data.contacts.length > 0
        ? data.contacts
            .slice(0, 200)
            .map((c) => `${c.name} [${c.id}]`)
            .join(", ")
        : "(none)";

    const systemPrompt = `You turn a personal assistant's dictated voice memo into one or more actionable draft tasks.

Rules:
- Split multiple distinct action items into SEPARATE drafts. If the memo describes only one action, return a single draft.
- title: short, imperative, <= 100 chars, no trailing punctuation.
- notes: fuller context from the memo. Keep it concise, do not repeat the title. Null if there's nothing useful to add.
- source: one of "From Boss" (task received from boss), "Delegated by Me" (assistant is asking someone else to do it), "Personal Reminder" (assistant's own reminder). Guess from the phrasing.
- category (optional, only if clearly implied): one of "Travel","Household","Scheduling","Errands","Gifts/Events","Finance","Vendors","Other".
- priority: "Urgent" only when the speaker explicitly conveys urgency ("ASAP", "urgent", "right away", "before end of day"). "Important" for elevated but not urgent. Otherwise "Normal".
- assigned_contact_id: ONLY set if a name in the memo unambiguously matches ONE contact in the SAVED CONTACTS list. Otherwise leave null and, for delegated tasks, put the raw spoken name in assigned_to_name.
- assigned_to_name: raw spoken name for delegated tasks when no contact matches. Otherwise null.
- due_date / due_time: only set if the speaker mentions something time-specific. Interpret relative ("tomorrow", "Friday") using today = ${today}. Format ISO date YYYY-MM-DD and 24-hour HH:MM. Otherwise null.

SAVED CONTACTS (name [id]): ${contactList}

Return strictly the JSON tool-call shape. Do not invent details.`;

    const chatRes = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Transcript:\n"""${transcript}"""`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_drafts",
              description: "Emit one or more structured draft tasks.",
              parameters: {
                type: "object",
                properties: {
                  drafts: {
                    type: "array",
                    minItems: 1,
                    maxItems: 8,
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        notes: { type: ["string", "null"] },
                        source: {
                          type: "string",
                          enum: [
                            "From Boss",
                            "Delegated by Me",
                            "Personal Reminder",
                          ],
                        },
                        category: {
                          type: ["string", "null"],
                          enum: [
                            "Travel",
                            "Household",
                            "Scheduling",
                            "Errands",
                            "Gifts/Events",
                            "Finance",
                            "Vendors",
                            "Other",
                            null,
                          ],
                        },
                        priority: {
                          type: "string",
                          enum: ["Normal", "Important", "Urgent"],
                        },
                        assigned_contact_id: { type: ["string", "null"] },
                        assigned_to_name: { type: ["string", "null"] },
                        due_date: { type: ["string", "null"] },
                        due_time: { type: ["string", "null"] },
                      },
                      required: ["title", "source", "priority"],
                    },
                  },
                },
                required: ["drafts"],
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "emit_drafts" },
        },
      }),
    });
    if (!chatRes.ok) {
      const body = await chatRes.text().catch(() => "");
      if (chatRes.status === 402) {
        throw new Error(
          "AI credits exhausted. Add credits in workspace billing.",
        );
      }
      throw new Error(
        `Structuring failed (${chatRes.status}): ${body.slice(0, 200)}`,
      );
    }
    const chatJson = (await chatRes.json()) as {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
    };
    const rawArgs =
      chatJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "";
    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(rawArgs);
    } catch {
      // Fall back to a single draft using the transcript itself.
      parsedRaw = {
        drafts: [
          {
            title: transcript.slice(0, 100),
            notes: transcript.length > 100 ? transcript : null,
            source: "Personal Reminder",
            priority: "Normal",
          },
        ],
      };
    }
    const parsed = structuredSchema.safeParse(parsedRaw);
    const drafts = parsed.success
      ? parsed.data.drafts
      : [
          {
            title: transcript.slice(0, 100),
            notes: transcript.length > 100 ? transcript : null,
            source: "Personal Reminder" as const,
            priority: "Normal" as const,
          },
        ];

    // Validate assigned_contact_id references exist in the caller's contacts.
    const validIds = new Set(data.contacts.map((c) => c.id));
    const cleaned = drafts.map((d) => ({
      ...d,
      assigned_contact_id:
        d.assigned_contact_id && validIds.has(d.assigned_contact_id)
          ? d.assigned_contact_id
          : null,
    }));

    return { transcript, drafts: cleaned };
  });
