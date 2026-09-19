import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CURRENCIES, isValidCurrencyCode } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CurrencyCombobox({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const code = search.trim().toUpperCase();
  const custom = code.length === 3 && !CURRENCIES.some((item) => item.value === code);

  function choose(next: string | null) {
    if (next && !isValidCurrencyCode(next)) {
      toast.error("Enter a valid three-letter ISO currency code.");
      return;
    }
    onChange(next);
    setSearch("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-12 w-full min-w-0 justify-between">
          <span className="truncate">{value ?? "Not set (plain numbers)"}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Search or enter ISO code…" />
          <CommandList>
            <CommandEmpty>
              {code.length === 3 ? "Press Enter to use this code." : "Enter a three-letter ISO code."}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem value="plain" onSelect={() => choose(null)}>
                <Check className={cn("size-4", value !== null && "opacity-0")} />
                Plain numbers
              </CommandItem>
              {custom ? (
                <CommandItem value={code} onSelect={() => choose(code)}>
                  <Check className={cn("size-4", value !== code && "opacity-0")} />
                  Use {code}
                </CommandItem>
              ) : null}
              {CURRENCIES.filter((item) => `${item.value} ${item.label}`.toLowerCase().includes(search.toLowerCase())).map((item) => (
                <CommandItem key={item.value} value={item.value} onSelect={() => choose(item.value)}>
                  <Check className={cn("size-4", value !== item.value && "opacity-0")} />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}