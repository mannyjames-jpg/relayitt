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
  const nudge =
    remaining === 0
      ? "Everything due is done. Nicely handled."
      : doneToday > 0
        ? `${doneToday} down, ${remaining} to go.`
        : overdue > 0
          ? "A couple slipped past. Let's catch them up first."
          : "Nothing late. Work through today in order.";

  return (
    <section className="pb-6 pt-11">
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {dateLabel}
      </p>
      <div className="grid min-w-0 grid-cols-1 gap-5 min-[821px]:grid-cols-[minmax(0,1fr)_minmax(200px,280px)] min-[821px]:items-end">
        <div className="min-w-0">
          <h1 className="text-[30px] font-normal leading-tight tracking-[-0.02em] text-foreground min-[821px]:text-[36px]">
            {greeting}
          </h1>
        </div>
        <div className="hidden min-w-[200px] min-[821px]:block">
          <p className="mb-2 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {remaining} left today
          </p>
          <div className="flex gap-1" aria-label={`${doneToday} of ${total} tasks completed today`}>
            {Array.from({ length: total }).map((_, index) => (
              <span
                key={index}
                className={`h-[3px] min-w-0 flex-1 ${index < doneToday ? "bg-alert" : "bg-foreground/25"}`}
              />
            ))}
          </div>
        </div>
      </div>
      <p className="mt-4 hidden text-[15px] text-muted-foreground min-[821px]:block">{nudge}</p>
      {upNext && (
        <div className="mt-3 flex min-w-0 items-baseline gap-2 overflow-hidden whitespace-nowrap text-[14px]">
          <span className="micro-label shrink-0">Up next</span>
          <span className="min-w-0 truncate text-foreground">
            {upNext.title}
            {upNext.time ? ` · ${upNext.time}` : ""}
            {upNext.date ? ` · ${upNext.date}` : ""}
          </span>
        </div>
      )}
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
    </section>
  );
}
