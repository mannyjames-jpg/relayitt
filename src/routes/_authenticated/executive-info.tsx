import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listExecInfo,
  lockExecInfo,
  revealExecSecret,
  saveExecField,
  saveExecRow,
  unlockExecInfo,
} from "@/lib/exec-info.functions";
import { isSecretField, type ExecRowKind } from "@/lib/exec-info.schema";
import { ErrorState } from "@/components/QueryState";
import { AppMobileTabs, AppMoreMenu, AppSidebar, useAppShell } from "@/components/AppSidebar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/executive-info")({
  head: () => ({
    meta: [
      { title: "Executive personal — Relay" },
      {
        name: "description",
        content:
          "A private, encrypted place for your executive's personal, travel, and company details.",
      },
      { property: "og:title", content: "Executive personal — Relay" },
      {
        property: "og:description",
        content:
          "A private, encrypted place for your executive's personal, travel, and company details.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExecutiveInfoPage,
});

const IDLE_MS = 10 * 60 * 1000;
const DATE_KEYS = new Set(["dob", "issued", "expires", "wedding_anniversary", "date"]);
const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

function isLockedError(e: unknown) {
  return e instanceof Error && /locked/i.test(e.message);
}

function parseDate(v: string): Date | null {
  const m = DATE_RE.exec(v.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return d.getMonth() === Number(m[1]) - 1 && d.getDate() === Number(m[2]) ? d : null;
}

function validDate(v: string) {
  return v.trim() === "" || parseDate(v) !== null;
}

const ghost =
  "inline-flex min-h-10 items-center justify-center border border-foreground px-4 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors hover:bg-foreground hover:text-background";

/* ------------------------------------------------------------------ */
/* Page-level context                                                  */
/* ------------------------------------------------------------------ */

type FieldView =
  | { id: string; section: string; field_key: string; is_secret: true; has_value: boolean }
  | { id: string; section: string; field_key: string; is_secret: false; value: string | null };
type RowView = {
  id: string;
  kind: string;
  data: Record<string, string>;
  position: number;
  has_secret: boolean;
};
type RowDraft = {
  kind: ExecRowKind;
  data: Record<string, string>;
  secret?: string;
  isNew?: boolean;
};

type Ctx = {
  editing: boolean;
  fields: Map<string, FieldView>;
  drafts: Record<string, string>;
  setDraft: (k: string, v: string) => void;
  rowDrafts: Record<string, RowDraft>;
  setRowDraft: (id: string, d: RowDraft) => void;
  errors: Set<string>;
  onLocked: () => void;
};
const ExecCtx = createContext<Ctx | null>(null);
function useExec() {
  const c = useContext(ExecCtx);
  if (!c) throw new Error("ExecCtx missing");
  return c;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function ExecutiveInfoPage() {
  const shell = useAppShell();
  const [access, setAccess] = useState<"checking" | "none" | "locked" | "open">("checking");
  const [factorId, setFactorId] = useState<string | null>(null);
  const lockFn = useServerFn(lockExecInfo);
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const f = data?.totp.find((x) => x.status === "verified");
      if (cancelled) return;
      if (!f) return setAccess("none");
      setFactorId(f.id);
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;
      setAccess(aal?.currentLevel === "aal2" ? "open" : "locked");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lock = useCallback(
    async (callServer: boolean) => {
      qc.removeQueries({ queryKey: ["exec-info"] });
      setAccess("locked");
      if (callServer) {
        try {
          await lockFn();
        } catch {
          /* already locked */
        }
      }
    },
    [lockFn, qc],
  );

  // Idle lock: 10 minutes without pointer/keyboard activity.
  useEffect(() => {
    if (access !== "open") return;
    let timer = window.setTimeout(() => void lock(true), IDLE_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void lock(true), IDLE_MS);
    };
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [access, lock]);

  return (
    <div
      data-relay-workspace
      className="min-h-screen bg-surface min-[821px]:grid min-[821px]:grid-cols-[232px_minmax(0,1fr)]"
    >
      <AppSidebar
        counts={shell.counts}
        currentRoute="/executive-info"
        displayName={shell.displayName}
        initial={shell.initial}
        onSignOut={shell.signOut}
      />
      <main className="min-w-0 bg-card pb-28 min-[821px]:pb-16">
        <div className="mx-auto max-w-[900px] px-5 min-[821px]:px-14">
          <div className="flex h-11 items-center justify-between min-[821px]:hidden">
            <span className="font-wordmark text-foreground">Relay</span>
            <AppMoreMenu onSignOut={shell.signOut} />
          </div>
          {access === "checking" && <p className="py-10 text-sm text-muted-foreground">Loading…</p>}
          {access === "none" && (
            <div className="mt-10 border border-foreground p-8">
              <h1 className="text-[24px] font-normal">Set up two-step login first</h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                Executive personal holds sensitive details, so it needs a second step to open.
              </p>
              <Link to="/settings" className={cn(ghost, "mt-6")}>
                Open security settings
              </Link>
            </div>
          )}
          {access === "open" && (
            <ExecContent onLock={() => void lock(true)} onLocked={() => void lock(false)} />
          )}
        </div>
      </main>
      <AppMobileTabs current="/executive-info" />
      {access === "locked" && factorId && (
        <CodeOverlay factorId={factorId} onUnlocked={() => setAccess("open")} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Code overlay                                                        */
/* ------------------------------------------------------------------ */

function CodeOverlay({ factorId, onUnlocked }: { factorId: string; onUnlocked: () => void }) {
  const unlock = useServerFn(unlockExecInfo);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  async function submit(code: string) {
    setBusy(true);
    setError(false);
    try {
      const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (vErr) throw new Error("bad");
      await unlock();
      onUnlocked();
    } catch {
      setError(true);
      setDigits(["", "", "", "", "", ""]);
      window.setTimeout(() => refs.current[0]?.focus(), 0);
    } finally {
      setBusy(false);
    }
  }

  function setAt(i: number, v: string) {
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (next.every((d) => d !== "")) void submit(next.join(""));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(250,248,244,.97)] px-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="code-title"
        className="w-full max-w-[420px] border border-foreground bg-card p-8"
      >
        <h2 id="code-title" className="text-[24px] font-normal">
          Enter your 6-digit code
        </h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Open your password app or authenticator and type the current Relay code to unlock Executive personal.
        </p>
        <div className="mt-6 grid grid-cols-6 gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              disabled={busy}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1}`}
              maxLength={6}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                if (raw.length >= 6) {
                  const all = raw.slice(0, 6).split("");
                  setDigits(all);
                  void submit(all.join(""));
                  return;
                }
                const v = raw.slice(-1);
                setAt(i, v);
                if (v && i < 5) refs.current[i + 1]?.focus();
              }}
              onPaste={(e) => {
                const raw = e.clipboardData.getData("text").replace(/\D/g, "");
                if (raw.length === 6) {
                  e.preventDefault();
                  const all = raw.split("");
                  setDigits(all);
                  void submit(raw);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) {
                  e.preventDefault();
                  const next = [...digits];
                  next[i - 1] = "";
                  setDigits(next);
                  refs.current[i - 1]?.focus();
                }
              }}
              className="h-14 w-full min-w-0 border border-foreground bg-white text-center text-[22px] tabular-nums outline-none focus:outline-1 focus:outline-offset-2 focus:outline-foreground"
            />
          ))}
        </div>
        {error && (
          <p className="mt-3 text-[13px] text-alert" role="alert">
            That code did not work. Try again.
          </p>
        )}
        <Link
          to="/dashboard"
          className="mt-6 inline-block text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Unlocked content                                                    */
/* ------------------------------------------------------------------ */

const TABS = [
  ["glance", "At a glance"],
  ["personal", "Personal"],
  ["family", "Family & dates"],
  ["travel", "Travel & documents"],
  ["accounts", "Accounts"],
  ["company", "Company"],
] as const;
type TabKey = (typeof TABS)[number][0];

function ExecContent({ onLock, onLocked }: { onLock: () => void; onLocked: () => void }) {
  const qc = useQueryClient();
  const list = useServerFn(listExecInfo);
  const saveField = useServerFn(saveExecField);
  const saveRow = useServerFn(saveExecRow);
  const q = useQuery({ queryKey: ["exec-info"], queryFn: () => list(), retry: false });
  const [tab, setTab] = useState<TabKey>("glance");
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraft>>({});
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.isError && isLockedError(q.error)) onLocked();
  }, [q.isError, q.error, onLocked]);

  const fields = useMemo(() => {
    const m = new Map<string, FieldView>();
    for (const f of (q.data?.fields ?? []) as FieldView[]) m.set(`${f.section}.${f.field_key}`, f);
    return m;
  }, [q.data]);
  const rows = (q.data?.rows ?? []) as RowView[];

  async function save() {
    const bad = new Set<string>();
    for (const [k, v] of Object.entries(drafts)) {
      if (DATE_KEYS.has(k.split(".")[1] ?? "") && !validDate(v)) bad.add(k);
    }
    for (const [id, d] of Object.entries(rowDrafts)) {
      for (const [col, v] of Object.entries(d.data)) {
        if (DATE_KEYS.has(col) && !validDate(v)) bad.add(`${id}.${col}`);
      }
    }
    setErrors(bad);
    if (bad.size) return;
    setSaving(true);
    try {
      for (const [k, v] of Object.entries(drafts)) {
        const [section, field_key] = k.split(".") as [string, string];
        const secret = isSecretField(section, field_key);
        if (secret && v === "") continue;
        const current = fields.get(k);
        if (!secret && current && !current.is_secret && (current.value ?? "") === v.trim())
          continue;
        await saveField({ data: { section, field_key, value: v, is_secret: secret } });
      }
      for (const [id, d] of Object.entries(rowDrafts)) {
        const hasContent = Object.values(d.data).some((v) => v.trim() !== "") || !!d.secret;
        if (d.isNew && !hasContent) continue;
        await saveRow({
          data: {
            ...(d.isNew ? {} : { id }),
            kind: d.kind,
            data: d.data,
            ...(d.secret ? { secret: d.secret } : {}),
          },
        });
      }
      await qc.invalidateQueries({ queryKey: ["exec-info"] });
      void qc.invalidateQueries({ queryKey: ["key-dates"] });
      setDrafts({});
      setRowDrafts({});
      setEditing(false);
      toast.success("Saved");
    } catch (e) {
      if (isLockedError(e)) onLocked();
      else toast.error("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const ctx: Ctx = {
    editing,
    fields,
    drafts,
    setDraft: (k, v) => setDrafts((d) => ({ ...d, [k]: v })),
    rowDrafts,
    setRowDraft: (id, d) => setRowDrafts((r) => ({ ...r, [id]: d })),
    errors,
    onLocked,
  };

  const nameField = fields.get("personal.full_name");
  const name = nameField && !nameField.is_secret ? nameField.value?.trim() : "";

  return (
    <ExecCtx.Provider value={ctx}>
      <header className="pt-8 min-[821px]:pt-11">
        <h1 className="text-[30px] font-normal tracking-[-0.02em] min-[821px]:text-[36px]">
          {name || "Executive personal"}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Everything you reach for about your executive, in one place.
        </p>
      </header>

      <div className="mt-6 flex h-12 items-stretch justify-between border border-foreground">
        <span className="flex min-w-0 items-center truncate px-4 text-[13px]">
          <span aria-hidden className="mr-2">
            ■
          </span>
          Unlocked · locks after 10 minutes idle
        </span>
        <div className="flex shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={() => (editing ? void save() : setEditing(true))}
            className="border-l border-foreground px-4 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors hover:bg-foreground hover:text-background"
          >
            {editing ? (saving ? "Saving…" : "Save") : "Edit"}
          </button>
          <button
            type="button"
            onClick={onLock}
            className="border-l border-foreground px-4 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors hover:bg-foreground hover:text-background"
          >
            Lock now
          </button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Executive personal sections"
        className="sticky top-0 z-20 -mx-5 mt-6 flex overflow-x-auto border-b border-border bg-card px-5 min-[821px]:mx-0 min-[821px]:px-0"
      >
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "relative h-12 shrink-0 whitespace-nowrap px-[14px] text-[12px] uppercase tracking-[0.12em]",
              tab === key
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {tab === key && (
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground" />
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="pt-2">
        {q.isPending ? (
          <p className="py-8 text-sm text-muted-foreground">Loading…</p>
        ) : q.isError ? (
          isLockedError(q.error) ? null : (
            <ErrorState
              message="Couldn't load Executive personal. Try again."
              onRetry={() => q.refetch()}
            />
          )
        ) : (
          <>
            {tab === "glance" && <GlanceTab rows={rows} />}
            {tab === "personal" && <PersonalTab rows={rows} />}
            {tab === "family" && <FamilyTab rows={rows} />}
            {tab === "travel" && <TravelTab />}
            {tab === "accounts" && <AccountsTab rows={rows} />}
            {tab === "company" && <CompanyTab rows={rows} />}
          </>
        )}
      </div>
    </ExecCtx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-4 border-t-[1.5px] border-foreground pb-2 pt-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em]">{title}</h2>
        {hint && <span className="text-right text-[13px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function EncryptedTag() {
  return (
    <span className="ml-2 inline-block border border-border px-2 py-[3px] text-[11px] uppercase leading-none tracking-[0.1em] text-muted-foreground">
      Encrypted
    </span>
  );
}

const inputCls =
  "h-11 w-full min-w-0 border border-border bg-white px-3 text-[15px] outline-none focus:border-foreground";

function NotSet() {
  return <span className="text-muted-foreground/60">Not set</span>;
}

function useCountdown(active: boolean, onDone: () => void) {
  const [left, setLeft] = useState(30);
  useEffect(() => {
    if (!active) return;
    setLeft(30);
    const t = window.setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          window.clearInterval(t);
          onDone();
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return left;
}

/** Masked secret with SHOW → HIDE 30s. Revealed value lives only in this component's state. */
function SecretValue({ fieldId, rowId }: { fieldId?: string; rowId?: string }) {
  const { onLocked } = useExec();
  const reveal = useServerFn(revealExecSecret);
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const left = useCountdown(value !== null, () => setValue(null));

  async function toggle() {
    if (value !== null) return setValue(null);
    setBusy(true);
    try {
      const res = await reveal({ data: fieldId ? { field_id: fieldId } : { row_id: rowId } });
      setValue(res.value);
    } catch (e) {
      if (isLockedError(e)) onLocked();
      else
        toast.error(
          e instanceof Error && /slow down/i.test(e.message)
            ? "Slow down — try again in a few minutes"
            : "Couldn't show this value",
        );
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex min-w-0 items-center justify-between gap-3">
      <span
        className={cn(
          "min-w-0",
          value === null ? "whitespace-nowrap tracking-[0.12em]" : "break-all",
        )}
      >
        {value ?? "••••••••"}
      </span>
      <button
        type="button"
        disabled={busy}
        aria-pressed={value !== null}
        onClick={() => void toggle()}
        className={cn(
          "min-h-11 shrink-0 border border-border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors",
          value !== null
            ? "border-foreground bg-foreground text-background"
            : "hover:border-foreground",
        )}
      >
        {value !== null ? `Hide ${left}s` : "Show"}
      </button>
    </span>
  );
}

function ExpiryLine({ value }: { value: string }) {
  const d = parseDate(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0)
    return (
      <span className="block text-[13px] font-semibold text-alert">
        Expired {-days} {-days === 1 ? "day" : "days"} ago
      </span>
    );
  return (
    <span
      className={cn(
        "block text-[13px]",
        days <= 90 ? "font-semibold text-alert" : "text-muted-foreground",
      )}
    >
      Expires in {days} {days === 1 ? "day" : "days"}
    </span>
  );
}

function FieldRow({
  section,
  fieldKey,
  label,
  readOnly,
  narrow,
}: {
  section: string;
  fieldKey: string;
  label: string;
  readOnly?: boolean;
  narrow?: boolean;
}) {
  const { editing, fields, drafts, setDraft, errors } = useExec();
  const k = `${section}.${fieldKey}`;
  const f = fields.get(k);
  const secret = isSecretField(section, fieldKey);
  const isDate = DATE_KEYS.has(fieldKey);
  const plain = f && !f.is_secret ? (f.value ?? "") : "";
  const edit = editing && !readOnly;

  let valueNode: React.ReactNode;
  if (edit) {
    valueNode = secret ? (
      <input
        type="password"
        autoComplete="new-password"
        aria-label={label}
        placeholder="Hidden. Type to replace"
        value={drafts[k] ?? ""}
        onChange={(e) => setDraft(k, e.target.value)}
        className={inputCls}
      />
    ) : (
      <>
        <input
          aria-label={label}
          placeholder={isDate ? "mm.dd.yyyy" : undefined}
          inputMode={isDate ? "numeric" : undefined}
          value={drafts[k] ?? plain}
          onChange={(e) => setDraft(k, e.target.value)}
          className={inputCls}
        />
        {errors.has(k) && <span className="mt-1 block text-[13px] text-alert">Use mm.dd.yyyy</span>}
      </>
    );
  } else if (secret) {
    valueNode = f && f.is_secret && f.has_value ? <SecretValue fieldId={f.id} /> : <NotSet />;
  } else {
    valueNode = plain ? (
      <span className="break-words">
        {plain}
        {fieldKey === "expires" && <ExpiryLine value={plain} />}
      </span>
    ) : (
      <NotSet />
    );
  }

  return (
    <div
      className={cn(
        "grid min-h-[52px] items-center gap-x-4 gap-y-1 border-t border-border py-2.5",
        narrow
          ? "min-[821px]:grid-cols-[140px_minmax(0,1fr)]"
          : "sm:grid-cols-[200px_minmax(0,1fr)]",
      )}
    >
      <div className="text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
        {secret && <EncryptedTag />}
      </div>
      <div className="min-w-0 text-[15px]">{valueNode}</div>
    </div>
  );
}

type Col = { key: string; label: string };

function RowTable({
  kind,
  rows,
  columns,
  secretLabel,
  addLabel,
  seedRoles,
  sort,
}: {
  kind: ExecRowKind;
  rows: RowView[];
  columns: Col[];
  secretLabel?: string;
  addLabel: string;
  seedRoles?: string[];
  sort?: (a: RowView, b: RowView) => number;
}) {
  const { editing, rowDrafts, setRowDraft, errors } = useExec();
  const mine = rows.filter((r) => r.kind === kind);
  if (sort) mine.sort(sort);
  const newIds = Object.keys(rowDrafts).filter(
    (id) => rowDrafts[id]!.isNew && rowDrafts[id]!.kind === kind,
  );

  // Placeholder role rows (pro table): shown until a row with that role exists.
  const missingRoles = (seedRoles ?? []).filter(
    (role) => !mine.some((r) => (r.data["role"] ?? "") === role),
  );
  useEffect(() => {
    if (!editing) return;
    for (const role of missingRoles) {
      const id = `seed-${kind}-${role}`;
      if (!rowDrafts[id]) setRowDraft(id, { kind, data: { role }, isNew: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const cols = `repeat(${columns.length + (secretLabel ? 1 : 0)}, minmax(0,1fr))`;

  function cell(id: string, base: RowView | null, col: Col) {
    const draft = rowDrafts[id];
    const value = draft?.data[col.key] ?? base?.data[col.key] ?? "";
    if (!editing) return value ? <span className="break-words">{value}</span> : <NotSet />;
    return (
      <>
        <input
          aria-label={col.label}
          placeholder={DATE_KEYS.has(col.key) ? "mm.dd.yyyy" : undefined}
          value={value}
          onChange={(e) =>
            setRowDraft(id, {
              kind,
              isNew: draft?.isNew ?? !base,
              secret: draft?.secret,
              data: { ...(base?.data ?? {}), ...(draft?.data ?? {}), [col.key]: e.target.value },
            })
          }
          className={inputCls}
        />
        {errors.has(`${id}.${col.key}`) && (
          <span className="mt-1 block text-[13px] text-alert">Use mm.dd.yyyy</span>
        )}
      </>
    );
  }

  function secretCell(id: string, base: RowView | null) {
    const draft = rowDrafts[id];
    if (editing)
      return (
        <input
          type="password"
          autoComplete="new-password"
          aria-label={secretLabel}
          placeholder="Hidden. Type to replace"
          value={draft?.secret ?? ""}
          onChange={(e) =>
            setRowDraft(id, {
              kind,
              isNew: draft?.isNew ?? !base,
              data: { ...(base?.data ?? {}), ...(draft?.data ?? {}) },
              secret: e.target.value,
            })
          }
          className={inputCls}
        />
      );
    return base?.has_secret ? <SecretValue rowId={base.id} /> : <NotSet />;
  }

  const line = (id: string, base: RowView | null, ghostRole?: string) => (
    <div
      key={id}
      className="grid min-h-[52px] grid-cols-1 items-center gap-x-4 gap-y-1 border-t border-border py-2.5 text-[15px] sm:[grid-template-columns:var(--cols)]"
      style={{ ["--cols" as string]: cols }}
    >
      {columns.map((c) => (
        <div key={c.key} className="min-w-0">
          <span className="block text-[11px] uppercase tracking-[0.1em] text-muted-foreground sm:hidden">
            {c.label}
          </span>
          {ghostRole && !editing && c.key === "role" ? ghostRole : cell(id, base, c)}
        </div>
      ))}
      {secretLabel && (
        <div className="min-w-0">
          <span className="block text-[11px] uppercase tracking-[0.1em] text-muted-foreground sm:hidden">
            {secretLabel}
            <EncryptedTag />
          </span>
          {secretCell(id, base)}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div
        className="hidden gap-x-4 pb-2 text-[12px] uppercase tracking-[0.1em] text-muted-foreground sm:grid"
        style={{ gridTemplateColumns: cols }}
      >
        {columns.map((c) => (
          <span key={c.key}>{c.label}</span>
        ))}
        {secretLabel && (
          <span>
            {secretLabel}
            <EncryptedTag />
          </span>
        )}
      </div>
      {mine.map((r) => line(r.id, r))}
      {!editing && missingRoles.map((role) => line(`seed-${kind}-${role}`, null, role))}
      {editing && newIds.map((id) => line(id, null))}
      {!editing && mine.length === 0 && missingRoles.length === 0 && (
        <p className="border-t border-border py-4 text-[14.5px] text-muted-foreground">
          Nothing added yet.
        </p>
      )}
      {editing && (
        <button
          type="button"
          className={cn(ghost, "mt-3")}
          onClick={() => setRowDraft(`new-${kind}-${Date.now()}`, { kind, data: {}, isNew: true })}
        >
          {addLabel}
        </button>
      )}
    </div>
  );
}

function rowValue(rows: RowView[], kind: string, match: (r: RowView) => boolean, col: string) {
  return rows.find((r) => r.kind === kind && match(r))?.data[col] ?? "";
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

type F = [string, string, string];
const EXEC_FIELDS: F[] = [
  ["personal", "full_name", "Full name"],
  ["personal", "full_name_other", "Name in other language"],
  ["personal", "dob", "Date of birth"],
  ["personal", "mobile", "Mobile phone"],
  ["personal", "personal_email", "Personal email"],
  ["personal", "home_address", "Home address"],
  ["personal", "national_id", "SSN / national ID"],
  ["personal", "health_member", "Health member #"],
  ["personal", "blood_type", "Blood type"],
  ["personal", "allergies", "Allergies"],
  ["personal", "sizes", "Sizes"],
  ["personal", "license", "Driver's license"],
  ["personal", "car_insurance", "Car insurance #"],
  ["personal", "wedding_anniversary", "Wedding anniversary"],
];

function Fields({ list, readOnly, narrow }: { list: F[]; readOnly?: boolean; narrow?: boolean }) {
  return (
    <>
      {list.map(([s, k, l]) => (
        <FieldRow
          key={`${s}.${k}`}
          section={s}
          fieldKey={k}
          label={l}
          readOnly={readOnly}
          narrow={narrow}
        />
      ))}
    </>
  );
}

function GlanceTab({ rows }: { rows: RowView[] }) {
  const { fields } = useExec();
  const emerg = fields.get("emergency.name_relationship");
  const emergPhone = fields.get("emergency.phone");
  const emergText = [emerg, emergPhone]
    .map((f) => (f && !f.is_secret ? (f.value ?? "") : ""))
    .filter(Boolean)
    .join(" · ");
  const accountant = rowValue(
    rows,
    "pro",
    (r) => r.data["role"] === "Accountant / bookkeeper",
    "name_firm",
  );
  const staticRow = (label: string, value: string) => (
    <div className="grid min-h-[52px] items-center gap-x-4 gap-y-1 border-t border-border py-2.5 sm:grid-cols-[200px_minmax(0,1fr)]">
      <div className="text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="min-w-0 break-words text-[15px]">{value || <NotSet />}</div>
    </div>
  );
  return (
    <>
      <Group title="Executive" hint="Edit in Personal">
        <Fields
          readOnly
          list={[
            ["personal", "full_name", "Full name"],
            ["personal", "mobile", "Mobile phone"],
            ["personal", "personal_email", "Personal email"],
            ["personal", "dob", "Date of birth"],
            ["personal", "home_address", "Home address"],
          ]}
        />
        {staticRow("Emergency contact", emergText)}
      </Group>
      <Group title="Travel documents" hint="Edit in Travel & documents">
        <Fields
          readOnly
          list={[
            ["passport1", "name", "Passport #1 name"],
            ["passport1", "number", "Passport #1 number"],
            ["passport1", "expires", "Passport #1 expires"],
            ["travel", "global_entry", "Known Traveler / Global Entry"],
            ["travel", "seat", "Preferred seat"],
          ]}
        />
      </Group>
      <Group title="Company" hint="Edit in Company">
        <Fields
          readOnly
          list={[
            ["company", "name", "Company name"],
            ["company", "registration", "Company registration #"],
          ]}
        />
        {staticRow("Accountant", accountant)}
      </Group>
    </>
  );
}

function PersonalTab({ rows }: { rows: RowView[] }) {
  return (
    <>
      <Group title="Executive">
        <Fields list={EXEC_FIELDS} />
      </Group>
      <Group title="Spouse / Partner">
        <Fields
          list={[
            ["spouse", "name", "Name"],
            ["spouse", "dob", "Date of birth"],
            ["spouse", "mobile", "Mobile phone"],
            ["spouse", "email", "Email"],
            ["spouse", "national_id", "SSN / national ID"],
          ]}
        />
      </Group>
      <Group title="Emergency contact">
        <Fields
          list={[
            ["emergency", "name_relationship", "Name / relationship"],
            ["emergency", "phone", "Phone"],
          ]}
        />
      </Group>
      <Group title="Children">
        <RowTable
          kind="child"
          rows={rows}
          addLabel="Add child"
          columns={[
            { key: "name", label: "Child name" },
            { key: "dob", label: "Date of birth" },
            { key: "school_notes", label: "School / notes" },
          ]}
        />
      </Group>
    </>
  );
}

function nextOccurrence(v: string | undefined): number {
  const d = v ? parseDate(v) : null;
  if (!d) return Number.MAX_SAFE_INTEGER;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let n = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (n < today) n = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  return n.getTime();
}

function FamilyTab({ rows }: { rows: RowView[] }) {
  return (
    <Group
      title="Family & important dates"
      hint="Use mm.dd.yyyy. Sorted by the next one coming up."
    >
      <RowTable
        kind="date"
        rows={rows}
        addLabel="Add date"
        sort={(a, b) => nextOccurrence(a.data["date"]) - nextOccurrence(b.data["date"])}
        columns={[
          { key: "occasion", label: "Person / occasion" },
          { key: "date", label: "Date (mm.dd.yyyy)" },
          { key: "relationship", label: "Relationship" },
          { key: "notes", label: "Notes" },
        ]}
      />
    </Group>
  );
}

const passport = (s: string): F[] => [
  [s, "name", "Name on passport"],
  [s, "number", "Number"],
  [s, "country", "Country"],
  [s, "issued", "Issued"],
  [s, "expires", "Expires"],
  [s, "scan_note", "Scan location"],
];
const visa = (s: string): F[] => [
  [s, "on_passport", "On passport"],
  [s, "number", "Number"],
  [s, "type_country", "Type / country"],
  [s, "issued", "Issued"],
  [s, "expires", "Expires"],
];

function hasAny(fields: Map<string, FieldView>, section: string) {
  for (const f of fields.values()) {
    if (f.section !== section) continue;
    if (f.is_secret ? f.has_value : !!f.value) return true;
  }
  return false;
}

function TravelTab() {
  const { editing, fields } = useExec();
  const [showP2, setShowP2] = useState(false);
  const [showV2, setShowV2] = useState(false);
  const p2 = showP2 || hasAny(fields, "passport2");
  const v2 = showV2 || hasAny(fields, "visa2");
  const pair = (left: React.ReactNode, right: React.ReactNode) => (
    <div className="grid gap-x-10 min-[821px]:grid-cols-2">
      {left}
      {right}
    </div>
  );
  return (
    <>
      {pair(
        <Group title="Passport #1">
          <Fields narrow list={passport("passport1")} />
        </Group>,
        <Group title="Visa #1">
          <Fields narrow list={visa("visa1")} />
        </Group>,
      )}
      {(p2 || v2) &&
        pair(
          p2 ? (
            <Group title="Passport #2">
              <Fields narrow list={passport("passport2")} />
            </Group>
          ) : (
            <div />
          ),
          v2 ? (
            <Group title="Visa #2">
              <Fields narrow list={visa("visa2")} />
            </Group>
          ) : (
            <div />
          ),
        )}
      <Group title="Trusted traveler & preferences">
        <Fields
          list={[
            ["travel", "global_entry", "Known Traveler / Global Entry"],
            ["travel", "tsa_precheck", "TSA PreCheck"],
            ["travel", "seat", "Preferred seat"],
            ["travel", "meal", "Meal"],
            ["travel", "airport", "Home airport"],
            ["travel", "rental_loyalty", "Car rental loyalty #"],
            ["travel", "notes", "Notes"],
          ]}
        />
      </Group>
      {(!p2 || !v2) && (
        <div className="mt-8 border-t border-border pt-4">
          <p className="text-[14px] text-muted-foreground">
            Passport #2 and Visa #2 can be added with Add passport or Add visa when you need them.
          </p>
          {editing && (
            <div className="mt-3 flex flex-wrap gap-2">
              {!p2 && (
                <button type="button" className={ghost} onClick={() => setShowP2(true)}>
                  Add passport
                </button>
              )}
              {!v2 && (
                <button type="button" className={ghost} onClick={() => setShowV2(true)}>
                  Add visa
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function AccountsTab({ rows }: { rows: RowView[] }) {
  const cols: Col[] = [
    { key: "program", label: "Program" },
    { key: "login_item", label: "Login saved in your password app" },
  ];
  return (
    <>
      <div className="mt-8 border border-foreground px-4 py-3 text-[14px]">
        Relay never stores passwords. Save each login in your password app, then note its item name
        here.
      </div>
      {(
        [
          ["airline", "Airline loyalty programs"],
          ["hotel", "Hotels and other travel"],
          ["other", "Video conferencing and other"],
        ] as const
      ).map(([kind, title]) => (
        <Group key={kind} title={title}>
          <RowTable
            kind={kind}
            rows={rows}
            columns={cols}
            secretLabel="Member #"
            addLabel="Add row"
          />
        </Group>
      ))}
    </>
  );
}

const PRO_ROLES = [
  "Accountant / bookkeeper",
  "Lawyer",
  "Bank contact",
  "Insurance agent",
  "IT / tech support",
];

function CompanyTab({ rows }: { rows: RowView[] }) {
  return (
    <>
      <Group title="Primary company">
        <Fields
          list={[
            ["company", "name", "Company name"],
            ["company", "registration", "Company registration #"],
            ["company", "address", "Registered address"],
            ["company", "tax_id", "Tax / VAT #"],
            ["company", "bank_login_item", "Company bank login item name"],
          ]}
        />
      </Group>
      <Group title="Key professional contacts">
        <RowTable
          kind="pro"
          rows={rows}
          seedRoles={PRO_ROLES}
          addLabel="Add contact"
          columns={[
            { key: "role", label: "Role" },
            { key: "name_firm", label: "Name / firm" },
            { key: "phone", label: "Phone" },
            { key: "email", label: "Email" },
          ]}
        />
      </Group>
    </>
  );
}
