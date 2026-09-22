import { ChevronDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const KEY = "life-os:details";

function read(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

/**
 * Everything that isn't needed right now. Closed by default, and each one
 * remembers whether you opened it (per device). Keeps a page to what matters
 * today without hiding anything for good.
 */
export function Details({
  id,
  title,
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  /** Stable id; the open state is remembered under it. */
  id: string;
  title: string;
  /** A line of what is inside, shown while closed. */
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [ready, setReady] = useState(false);

  // Read the remembered state after mounting, so the server and the first
  // render agree.
  useEffect(() => {
    const remembered = read()[id];
    if (remembered != null) setOpen(remembered);
    setReady(true);
  }, [id]);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...read(), [id]: next }));
      } catch {
        // Private mode: it just won't be remembered.
      }
      return next;
    });
  };

  return (
    <section className={cn("min-w-0", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`details-${id}`}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-1 text-left transition-colors duration-150 hover:bg-accent"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{title}</span>
          {summary && !open ? (
            <span className="block truncate text-xs text-muted-foreground">{summary}</span>
          ) : null}
        </span>
      </button>
      {open ? (
        <div
          id={`details-${id}`}
          className={cn("pt-3", ready && "animate-in fade-in slide-in-from-top-1 duration-200 ease-out")}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
