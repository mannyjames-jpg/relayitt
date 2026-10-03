export function HeroSummary({
  dateLabel,
  greeting,
  followUpCount,
  upNext,
  overdue,
  dueToday,
  doneToday,
}: {
  dateLabel: string;
  greeting: string;
  followUpCount: number;
  upNext: { title: string; time: string | null; date: string | null } | null;
  overdue: number;
  dueToday: number;
  doneToday: number;
}) {
  const remaining = overdue + dueToday;
  const total = remaining + doneToday;
  const pct = total === 0 ? 1 : doneToday / total;

  const r = 38;
  const circumference = 2 * Math.PI * r;

  return (
    <section className="border-b border-border pb-7 pt-5">
      <div className="grid min-w-0 grid-cols-1 gap-5 min-[821px]:grid-cols-[minmax(0,1fr)_auto] min-[821px]:items-center">
        <div className="min-w-0">
          <p className="micro-label mb-2">{dateLabel}</p>
          <h1 className="font-hero text-[30px] font-normal leading-tight text-foreground min-[821px]:text-[36px]">
            {greeting}
          </h1>
          {(overdue > 0 || followUpCount > 0) && (
            <p className="mt-2 truncate whitespace-nowrap text-[13px] text-muted-foreground">
              {overdue > 0 && (
                <span className="text-alert">
                  <strong className="font-semibold">{overdue}</strong> late
                </span>
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
        </div>

        <div className="relative h-[92px] w-[92px] shrink-0 max-[820px]:ml-0">
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
              className="transition-[stroke-dashoffset] duration-300 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-hero text-2xl leading-none text-foreground">{remaining}</span>
            <span className="micro-label mt-1 whitespace-nowrap text-[9px] leading-none [text-indent:0]">
              left today
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
