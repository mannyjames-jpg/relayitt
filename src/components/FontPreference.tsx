import { useEffect } from "react";
import { applyFont, FONT_STORAGE_KEY, type FontChoice } from "@/lib/fonts";

/**
 * Applies the saved font preference app-wide. Reads the locally cached
 * choice on mount so there is no flash; Settings keeps the cache in sync
 * with the stored profile value.
 */
export function FontPreference() {
  useEffect(() => {
    const saved = window.localStorage.getItem(FONT_STORAGE_KEY);
    if (saved === "system" || saved === "inter" || saved === "plex") {
      applyFont(saved as FontChoice);
    }
  }, []);
  return null;
}
