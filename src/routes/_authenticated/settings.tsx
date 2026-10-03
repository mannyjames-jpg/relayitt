import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getProfile, saveProfile } from "@/lib/profile.functions";
import {
  applyFont,
  FONT_LABELS,
  FONT_STORAGE_KEY,
  type FontChoice,
} from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { SecuritySettings } from "@/components/SecuritySettings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Relay" },
      {
        name: "description",
        content:
          "Set the display name used in your greeting and choose the typeface Relay uses across the app.",
      },
      { property: "og:title", content: "Settings — Relay" },
      {
        property: "og:description",
        content:
          "Set the display name used in your greeting and choose the typeface Relay uses across the app.",
      },
    ],
  }),
  component: Settings,
});

const FONTS: FontChoice[] = ["system", "inter", "plex"];

function Settings() {
  const qc = useQueryClient();
  const get = useServerFn(getProfile);
  const save = useServerFn(saveProfile);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => get(),
  });

  const [name, setName] = useState("");
  const [font, setFont] = useState<FontChoice>("system");

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? "");
    const f = (profile.font_choice ?? "system") as FontChoice;
    setFont(f);
    applyFont(f);
    window.localStorage.setItem(FONT_STORAGE_KEY, f);
  }, [profile]);

  const saveM = useMutation({
    mutationFn: save,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Settings saved");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Couldn't save settings"),
  });

  function chooseFont(f: FontChoice) {
    setFont(f);
    applyFont(f);
    window.localStorage.setItem(FONT_STORAGE_KEY, f);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link to="/dashboard" aria-label="Back to dashboard">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="font-hero text-2xl">Settings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <SecuritySettings />
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display">Profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The name Relay greets you with on the dashboard.
          </p>
          <div className="mt-4">
            <Label htmlFor="display-name" className="text-xs">
              Display name
            </Label>
            <Input
              id="display-name"
              value={name}
              maxLength={80}
              placeholder="e.g. Selah"
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display">Typeface</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Applied everywhere in the app.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {FONTS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={font === f}
                onClick={() => chooseFont(f)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  font === f
                    ? "border-foreground/40 bg-secondary"
                    : "border-border hover:bg-secondary/60",
                )}
              >
                <span className="block text-sm font-semibold">
                  {FONT_LABELS[f]}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Aa Bb Cc — 123
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="flex justify-end">
          <Button
            onClick={() =>
              saveM.mutate({
                data: { display_name: name.trim() || null, font_choice: font },
              })
            }
            disabled={saveM.isPending}
          >
            Save settings
          </Button>
        </div>
      </main>
    </div>
  );
}
