import { GROUP_COLOR } from "@/lib/task-style";

type Stat = { label: string; value: number; color: string };

/**
 * Hero: circular progress ring for what's left today, a colour-dotted stat
 * row, and a short encouraging line. Presentation only.
 */
export function HeroSummary({
  greeting,
  overdue,
  dueToday,
  waiting,
  comingUp,
  whenever,
  doneToday,
}: {
  greeting: string;
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
    { label: "Overdue", value: overdue, color: CATEGORY_COLOR.Finance },
    { label: "Due today", value: dueToday, color: CATEGORY_COLOR["Gifts/Events"] },
    { label: "Waiting on someone", value: waiting, color: CATEGORY_COLOR.Errands },
    { label: "Coming up", value: comingUp, color: CATEGORY_COLOR.Travel },
    { label: "Whenever", value: whenever, color: CATEGORY_COLOR.Scheduling },
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
    <section className="rounded-[22px] border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative h-[92px] w-[92px] shrink-0">
          <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
            <defs>
              <linearGradient id="relay-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--ring-from)" />
                <stop offset="100%" stopColor="var(--ring-to)" />
              </linearGradient>
            </defs>
            <circle
              cx="48"
              cy="48"
              r={r}
              fill="none"
              stroke="var(--muted)"
              strokeWidth="8"
            />
            <circle
              cx="48"
              cy="48"
              r={r}
              fill="none"
              stroke="url(#relay-ring)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct)}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl leading-none text-foreground">
              {remaining}
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              left today
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[24px] leading-tight text-foreground sm:text-[28px]">
            {greeting}
          </h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{s.value}</span>{" "}
                  {s.label}
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
