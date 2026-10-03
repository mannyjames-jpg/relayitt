import { GROUP_DOT } from "@/lib/task-style";

type Stat = { label: string; value: number; color: string };

/**
 * Hero: circular progress ring for what's left today, a stat row keyed by
 * neutral ink shades, and a short encouraging line. Presentation only.
 */
export function HeroSummary({
  greeting,
  followUpCount,
  upNext,
  overdue,
  dueToday,
  waiting,
  comingUp,
  whenever,
  doneToday,
}: {
  greeting: string;
  followUpCount: number;
  upNext: { title: string; time: string | null; date: string | null } | null;
  overdue: number;
  dueToday: number;
  waiting: number;
  comingUp: number;
  whenever: number;
  doneToday: number;
}) {
  const remaining = overdue + dueToday;
  const total = remaining + doneToday;
  const pct = total === 0 ? 1 : doneToday / total;

  const r = 38;
  const circumference = 2 * Math.PI * r;

  const stats: Stat[] = [
    { label: "Overdue", value: overdue, color: GROUP_DOT.overdue },
    { label: "Due today", value: dueToday, color: GROUP_DOT.today },
    { label: "Waiting on someone", value: waiting, color: GROUP_DOT.waiting },
    { label: "Coming up", value: comingUp, color: GROUP_DOT.upcoming },
    { label: "Whenever", value: whenever, color: GROUP_DOT.whenever },
  ];

  const message =
    total === 0
      ? "Nothing on the books today — enjoy the quiet."
      : remaining === 0
        ? "All clear for today. Beautifully done."
        : overdue > 0
          ? "A couple slipped past — let's catch them up first."
          : remaining === 1
            ? "Just one thing left today. Easy."
            : `${remaining} things left today — you've got this.`;

  return (
    <section className="border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative mx-auto h-[92px] w-[92px] shrink-0 self-center">
          <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
            <circle cx="48" cy="48" r={r} fill="none" stroke="var(--border)" strokeWidth="1.5" />
            <circle
              cx="48"
              cy="48"
              r={r}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth="1.5"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct)}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-hero text-2xl leading-none text-foreground">{remaining}</span>
            <span className="micro-label mt-1 whitespace-nowrap text-[9px] leading-none [text-indent:0]">
              left today
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="font-hero text-[24px] leading-tight text-foreground sm:text-[28px]">
            {greeting}
          </h1>
          {(overdue > 0 || followUpCount > 0) && (
            <p className="mt-2 truncate whitespace-nowrap text-[13px] text-muted-foreground">
              {overdue > 0 && (
                <>
                  <strong className="font-semibold text-foreground">{overdue}</strong> late
                </>
              )}
              {overdue > 0 && followUpCount > 0 && " · "}
              {followUpCount > 0 && (
                <>
                  <strong className="font-semibold text-foreground">{followUpCount}</strong> to
                  follow up
                </>
              )}
            </p>
          )}
          {upNext && (
            <div className="mt-2 flex min-w-0 items-baseline gap-2 overflow-hidden whitespace-nowrap text-[14px]">
              <span className="micro-label shrink-0">Up next</span>
              <span className="min-w-0 truncate text-foreground">
                {upNext.title}
                {upNext.time ? ` · ${upNext.time}` : ""}
                {upNext.date ? ` · ${upNext.date}` : ""}
              </span>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span aria-hidden className="h-1.5 w-1.5" style={{ background: s.color }} />
                <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  <span className="font-semibold text-foreground">{s.value}</span> {s.label}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </section>
  );
}
