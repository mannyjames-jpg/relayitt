import { PETAL_COLORS } from "@/lib/task-style";

/**
 * Small colored dots that scatter outward and fade — celebratory feedback
 * when a task is checked off. Purely decorative.
 */
export function PetalBurst() {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {PETAL_COLORS.map((c, i) => {
        const angle = (i / PETAL_COLORS.length) * Math.PI * 2;
        const dist = 22 + (i % 3) * 6;
        return (
          <span
            key={c}
            className="animate-petal absolute h-1.5 w-1.5 rounded-full"
            style={
              {
                background: c,
                "--px": `${Math.cos(angle) * dist}px`,
                "--py": `${Math.sin(angle) * dist}px`,
                animationDelay: `${i * 18}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}
