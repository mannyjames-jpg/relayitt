import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, UserRound } from "lucide-react";
import { contactFns, taskFns } from "@/lib/api-client";
import { ErrorState, LoadingState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({ meta: [{ title: "Contacts — Relay" }] }),
  component: ContactsPage,
});

function ContactsPage() {
  const list = contactFns.list;
  const listT = taskFns.list;
  const create = contactFns.create;
  const qc = useQueryClient();

  const contactsQ = useQuery({
    queryKey: ["contacts"],
    queryFn: () => list(),
  });
  const contacts = contactsQ.data ?? [];
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => listT(),
  });

  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.assigned_to && t.status !== "Complete") {
      counts.set(t.assigned_to, (counts.get(t.assigned_to) ?? 0) + 1);
    }
  }

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [err, setErr] = useState<string | null>(null);

  const createM = useMutation({
    mutationFn: create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setOpen(false);
      setForm({ name: "", role: "", phone: "", email: "", notes: "" });
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-2">
          <Link to="/dashboard" aria-label="Back">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="font-hero text-2xl flex-1">Contacts</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New contact</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setErr(null);
                  if (!form.name.trim()) return setErr("Name is required");
                  createM.mutate({
                    data: {
                      name: form.name.trim(),
                      role: form.role || null,
                      phone: form.phone || null,
                      email: form.email || null,
                      notes: form.notes || null,
                    },
                  });
                }}
              >
                <Field label="Name" required>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    maxLength={100}
                    required
                  />
                </Field>
                <Field label="Role">
                  <Input
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="Driver, Vendor, etc."
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
                {!form.phone && !form.email && (
                  <p className="text-xs text-muted-foreground">
                    Tip: adding a phone or email lets you reach them faster.
                  </p>
                )}
                <Field label="Notes">
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                  />
                </Field>
                {err && <p className="text-sm text-destructive">{err}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createM.isPending}>
                    Save
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {contactsQ.isPending ? (
          <LoadingState />
        ) : contactsQ.isError ? (
          <ErrorState
            message="Couldn't load your contacts. Try again."
            onRetry={() => contactsQ.refetch()}
          />
        ) : contacts.length === 0 ? (
          <div className="text-center pt-8 space-y-3">
            <p className="text-sm text-muted-foreground">No contacts yet</p>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add a contact
            </Button>
          </div>
        ) : (
          <ul className="rounded-lg border border-border bg-card divide-y divide-border">
            {contacts.map((c) => {
              const n = counts.get(c.id) ?? 0;
              return (
                <li key={c.id}>
                  <Link
                    to="/contacts/$id"
                    params={{ id: c.id }}
                    className="flex items-center gap-3 px-3 py-3 min-h-[56px] hover:bg-accent"
                  >
                    <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {c.name}
                      </div>
                      {c.role && (
                        <div className="text-xs text-muted-foreground truncate">
                          {c.role}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {n} active
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
