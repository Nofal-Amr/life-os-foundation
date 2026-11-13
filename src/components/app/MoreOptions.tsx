import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Short forms: the few fields that make the thing come first; everything
 * else sits behind "More options". Nothing is removed, only folded.
 *
 * `setCount` says how many folded fields already hold something, so a filled
 * field is never hidden without a hint. It opens by itself when told to
 * (`defaultOpen`), e.g. when editing something that uses the extras.
 */
export function MoreOptions({
  children,
  defaultOpen = false,
  setCount = 0,
  label = "More options",
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  setCount?: number;
  label?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="border-t border-border pt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 transition-transform duration-200 ease-out",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
        <span>{label}</span>
        {setCount > 0 && !open ? (
          <span className="ml-auto text-xs font-normal">{setCount} set</span>
        ) : null}
      </button>
      <div id={id} hidden={!open} className="space-y-4 pt-3">
        {children}
      </div>
    </div>
  );
}
