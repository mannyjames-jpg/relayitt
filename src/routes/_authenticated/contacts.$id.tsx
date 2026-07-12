import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteContact,
  getContact,
  updateContact,
} from "@/lib/contacts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatTime } from "@/lib/date-utils";

export const Route = createFileRoute("/_authenticated/contacts/$id")({
  head: () => ({ meta: [{ title: "Contact — Relay" }] }),
  component: ContactDetail,
});

function ContactDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const get = useServerFn(getContact);
  const update = useServerFn(updateContact);
  const del = useServerFn(deleteContact);

  const { data } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => get({ data: { id } }),
  });

  const [form, setForm] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
    notes: "",
  });

  useEffect(() => {
    if (data?.contact) {
      setForm({
        name: data.contact.name ?? "",
        role: data.contact.role ?? "",
        phone: data.contact.phone ?? "",
        email: data.contact.email ?? "",
        notes: data.contact.notes ?? "",
      });
    }
  }, [data]);

  const updateM = useMutation({
    mutationFn: update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact", id] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Saved");
    },
  });
  const deleteM = useMutation({ mutationFn: del });

  const active = (data?.tasks ?? []).filter((t) => t.status !== "Done");
  const done = (data?.tasks ?? []).filter((t) => t.status === "Done").slice(0, 25);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-2">
          <Link to="/contacts" aria-label="Back">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold flex-1 truncate">
            {form.name || "Contact"}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-6">
        <section className="space-y-3">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={100}
            />
          </Field>
          <Field label="Role">
            <Input
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={async () => {
                if (!confirm("Delete this contact?")) return;
                await deleteM.mutateAsync({ data: { id } });
                qc.invalidateQueries({ queryKey: ["contacts"] });
                window.history.back();
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button
              onClick={() =>
                updateM.mutate({
                  data: {
                    id,
                    name: form.name.trim(),
                    role: form.role || null,
                    phone: form.phone || null,
                    email: form.email || null,
                    notes: form.notes || null,
                  },
                })
              }
              disabled={updateM.isPending || !form.name.trim()}
            >
              Save
            </Button>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Active tasks ({active.length})
          </h2>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active tasks.</p>
          ) : (
            <ul className="rounded-lg border border-border bg-card divide-y divide-border">
              {active.map((t) => (
                <li key={t.id} className="px-3 py-3 text-sm">
                  <div>{t.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t.status}
                    {t.due_date && ` · ${t.due_date}`}
                    {t.due_time && ` ${formatTime(t.due_time)}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {done.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Recently completed
            </h2>
            <ul className="rounded-lg border border-border bg-card divide-y divide-border">
              {done.map((t) => (
                <li key={t.id} className="px-3 py-2 text-sm text-muted-foreground">
                  <span className="line-through">{t.title}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
