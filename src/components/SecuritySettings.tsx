import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listAuditLog, recordMfaEvent } from "@/lib/exec-info.functions";
import { cn } from "@/lib/utils";

const ghost =
  "inline-flex h-10 items-center justify-center border border-foreground px-4 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors hover:bg-foreground hover:text-background disabled:pointer-events-none disabled:opacity-50";

function GroupHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t-[1.5px] border-foreground pt-3 pb-2">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em]">{title}</h2>
      {hint && <span className="text-[13px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-border py-3 sm:grid-cols-[200px_1fr] sm:gap-4">
      <div className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="text-[15px]">{children}</div>
    </div>
  );
}

const ACTION_TEXT: Record<string, string> = {
  unlock: "Unlocked Executive personal",
  lock: "Locked Executive personal",
  mfa_enrolled: "Turned on two-step login",
  mfa_removed: "Turned off two-step login",
};

function codeOk(c: string) {
  return /^\d{6}$/.test(c);
}

export function SecuritySettings() {
  const qc = useQueryClient();
  const audit = useServerFn(recordMfaEvent);
  const getLog = useServerFn(listAuditLog);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [offMode, setOffMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const log = useQuery({
    queryKey: ["exec-audit"],
    queryFn: () => getLog({ data: { limit: 50 } }),
  });

  async function refresh() {
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp.find((f) => f.status === "verified");
    setFactorId(verified?.id ?? null);
    setLoaded(true);
    return data;
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function startEnroll() {
    setBusy(true);
    try {
      const data = await refresh();
      // Clear abandoned unverified attempts so a fresh code can be issued.
      for (const f of data?.all ?? []) {
        if (f.factor_type === "totp" && f.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data: e, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Relay ${Date.now()}`,
      });
      if (error || !e) throw new Error("Couldn't start setup. Try again.");
      setEnroll({ id: e.id, qr: e.totp.qr_code, secret: e.totp.secret });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start setup");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (loaded && !factorId && !enroll) void startEnroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, factorId]);

  async function verify() {
    if (!enroll || !codeOk(code)) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code });
    setBusy(false);
    if (error) {
      toast.error("That code didn't match. Try the newest one.");
      return;
    }
    setCode("");
    setEnroll(null);
    await audit({ data: { action: "mfa_enrolled" } });
    await refresh();
    qc.invalidateQueries({ queryKey: ["exec-audit"] });
    toast.success("Two-step login is on");
  }

  async function turnOff() {
    if (!factorId || !codeOk(code)) return;
    setBusy(true);
    try {
      const v = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (v.error) throw new Error("That code didn't match. Try the newest one.");
      const u = await supabase.auth.mfa.unenroll({ factorId });
      if (u.error) throw new Error("Couldn't turn it off. Try again.");
      await supabase.auth.refreshSession();
      await audit({ data: { action: "mfa_removed" } });
      setCode("");
      setOffMode(false);
      setFactorId(null);
      qc.invalidateQueries({ queryKey: ["exec-audit"] });
      toast.success("Two-step login is off");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't turn it off");
    } finally {
      setBusy(false);
    }
  }

  const codeInput = (onEnter: () => void) => (
    <input
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
      onKeyDown={(e) => e.key === "Enter" && onEnter()}
      aria-label="6-digit code"
      placeholder="000000"
      className="h-12 w-40 border border-foreground bg-white px-3 text-[16px] tracking-[0.2em] tabular-nums outline-none focus:outline-1 focus:outline-offset-2 focus:outline-foreground"
    />
  );

  return (
    <section className="space-y-8">
      <div>
        <GroupHeader title="Security" hint="Two-step login" />
        {!loaded ? (
          <p className="border-t border-border py-4 text-sm text-muted-foreground">Checking…</p>
        ) : factorId ? (
          <div className="space-y-3 pt-2">
            <div className="border border-foreground px-4 py-3 text-[15px]">
              <span className="font-semibold">Two-step login is on</span>
              <span className="text-muted-foreground">
                {" "}
                · Executive personal asks for a 6-digit code
              </span>
            </div>
            {offMode ? (
              <div className="flex flex-wrap items-center gap-2">
                {codeInput(turnOff)}
                <button
                  type="button"
                  className={ghost}
                  disabled={busy || !codeOk(code)}
                  onClick={turnOff}
                >
                  Confirm turn off
                </button>
                <button
                  type="button"
                  className={ghost}
                  onClick={() => {
                    setOffMode(false);
                    setCode("");
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={ghost} onClick={() => setOffMode(true)}>
                  Turn off
                </button>
              </div>
            )}
            <p className="text-[13px] text-muted-foreground">
              Recovery codes aren't available for two-step login. If you lose your device, you'll
              need to be reset by the account owner.
            </p>
          </div>
        ) : (
          <ol className="pt-1">
            <li className="grid grid-cols-[40px_1fr] border-t border-border py-4">
              <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">
                01
              </span>
              <div>
                <p className="text-[15px]">Open your password app or authenticator</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Apple Passwords, Google Authenticator, Bitwarden, or Authy all work and are free.
                  Choose to add a new code.
                </p>
              </div>
            </li>
            <li className="grid grid-cols-[40px_1fr] border-t border-border py-4">
              <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">
                02
              </span>
              <div>
                <p className="text-[15px]">Scan this code</p>
                <div className="mt-3 flex h-[168px] w-[168px] items-center justify-center border border-foreground bg-white p-2">
                  {enroll ? (
                    <img src={enroll.qr} alt="Two-step login QR code" className="h-full w-full" />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {busy ? "Preparing…" : ""}
                    </span>
                  )}
                </div>
                {enroll && (
                  <p className="mt-3 text-[13px]">
                    <span className="mr-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Key
                    </span>
                    <span className="break-all font-mono">{enroll.secret}</span>
                  </p>
                )}
              </div>
            </li>
            <li className="grid grid-cols-[40px_1fr] border-t border-border py-4">
              <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">
                03
              </span>
              <div>
                <p className="text-[15px]">Type the 6-digit code it shows</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {codeInput(verify)}
                  <button
                    type="button"
                    className={cn(ghost, "h-12")}
                    disabled={busy || !enroll || !codeOk(code)}
                    onClick={verify}
                  >
                    Verify
                  </button>
                </div>
              </div>
            </li>
          </ol>
        )}
      </div>

      <div>
        <GroupHeader title="Protection" hint="Always on" />
        <Row label="Encryption">
          <div className="flex items-start justify-between gap-3">
            <div>
              Sensitive fields are encrypted before they are saved
              <div className="text-[13px] text-muted-foreground">
                Key stored as a project secret, never in the database
              </div>
            </div>
            <span className="border border-foreground px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
              Active
            </span>
          </div>
        </Row>
        <Row label="Auto lock">Executive personal locks after 10 minutes idle</Row>
        <Row label="Hidden by default">
          Numbers show as dots until you tap Show, then hide again after 30 seconds
        </Row>
        <Row label="Passwords">
          Never stored here. Each login is saved in your password app, and Relay keeps only its name
        </Row>
      </div>

      <div>
        <GroupHeader title="Activity" hint="Last 50" />
        {log.isError ? (
          <p className="border-t border-border py-4 text-sm text-muted-foreground">
            Couldn't load activity.
          </p>
        ) : (log.data ?? []).length === 0 ? (
          <p className="border-t border-border py-4 text-sm text-muted-foreground">
            No activity yet.
          </p>
        ) : (
          <ul>
            {(log.data ?? []).map((a) => (
              <li
                key={a.id}
                className="flex items-baseline justify-between gap-4 border-t border-border py-3"
              >
                <span className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground">
                  {new Date(a.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span className="min-w-0 truncate text-right text-[15px]">
                  {(a.label ?? ACTION_TEXT[a.action] ?? a.action).replaceAll(
                    "Executive info",
                    "Executive personal",
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
