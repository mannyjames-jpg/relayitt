export type FontChoice = "system" | "inter" | "plex";

export const FONT_STACKS: Record<FontChoice, string> = {
  system:
    x,
  inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
  plex: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
};

export const FONT_LABELS: Record<FontChoice, string> = {
  system: "System (default)",
  inter: "Inter",
  plex: "IBM Plex Sans",
};

export const FONT_STORAGE_KEY = "relay.font";

export function applyFont(choice: FontChoice) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--app-font", FONT_STACKS[choice]);
}
