import { useEffect, useState } from "react";
import { X, CircleCheck, PenLine, Palette } from "lucide-react";

const KEY = "relay.onboarding.dismissed.v1";

/**
 * Friendly, dismissible "how this works" card. Dismissal is remembered
 * per browser so it never comes back.
 */
export function OnboardingCard() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(KEY) !== "1");
  }, []);

  if (!visible) return null;

  const items = [
    {
      Icon: CircleCheck,
      title: "Tap the circle",
      body: "That marks a task done — a little burst says it's handled.",
    },
    {
      Icon: PenLine,
      title: "Tap the task itself",
      body: "It opens up so you can change the wording, date or who's on it.",
    },
    {
      Icon: Palette,
      title: "The colour is the topic",
      body: "The stripe on the left and the little tag always match — same colour, same kind of task.",
    },
  ];

  return (
    <section className="relative rounded-[24px] border border-border bg-white/80 p-5">
      <button
        type="button"
        aria-label="Dismiss this guide"
        onClick={() => {
          window.localStorage.setItem(KEY, "1");
          setVisible(false);
        }}
        className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>

      <h2 className="font-display text-lg text-foreground">
        A quick tour, then it's yours
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {items.map(({ Icon, title, body }) => (
          <div key={title} className="flex gap-3">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--cat-ink-tint)" }}
            >
              <Icon
                className="h-4 w-4"
                strokeWidth={2}
                style={{ color: "var(--cat-ink)" }}
              />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-sm leading-snug text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
