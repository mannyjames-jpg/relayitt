import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type ContactOption = {
  id: string;
  name: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
};

interface Props {
  contacts: ContactOption[];
  contactId: string | null;
  freeText: string;
  onChange: (v: { contactId: string | null; freeText: string }) => void;
  placeholder?: string;
  compact?: boolean;
}

export function AssigneeCombobox({
  contacts,
  contactId,
  freeText,
  onChange,
  placeholder = "Assign to…",
  compact,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => contacts.find((c) => c.id === contactId),
    [contacts, contactId],
  );
  const label = selected?.name || freeText || "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          size={compact ? "sm" : "default"}
          className={cn(
            "justify-between font-normal",
            compact ? "h-8 w-[150px] text-xs" : "h-11 w-full",
            !label && "text-muted-foreground",
          )}

        >
          <span className="truncate">{label || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[280px] pointer-events-auto" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type a name…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {query.trim() ? (
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => {
                    onChange({ contactId: null, freeText: query.trim() });
                    setOpen(false);
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Use “{query.trim()}”
                </button>
              ) : (
                <div className="p-3 text-sm text-muted-foreground">
                  No contacts yet.
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {contacts
                .filter((c) =>
                  c.name.toLowerCase().includes(query.toLowerCase().trim()),
                )
                .slice(0, 20)
                .map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      onChange({ contactId: c.id, freeText: "" });
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        contactId === c.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{c.name}</span>
                    {c.role && (
                      <span className="ml-2 text-xs text-muted-foreground truncate">
                        {c.role}
                      </span>
                    )}
                  </CommandItem>
                ))}
              {query.trim() &&
                !contacts.some(
                  (c) => c.name.toLowerCase() === query.toLowerCase().trim(),
                ) && (
                  <CommandItem
                    value={`__new__${query}`}
                    onSelect={() => {
                      onChange({ contactId: null, freeText: query.trim() });
                      setOpen(false);
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Use “{query.trim()}”
                  </CommandItem>
                )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
