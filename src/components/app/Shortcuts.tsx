import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Pages reachable with "g" then a letter. */
const GO: Record<string, { to: string; label: string }> = {
  d: { to: "/dashboard", label: "Today" },
  t: { to: "/tasks", label: "Do (tasks)" },
  m: { to: "/finance", label: "Money" },
  b: { to: "/health", label: "Body" },
  s: { to: "/spirit", label: "Spirit" },
  n: { to: "/notes", label: "Notes" },
  c: { to: "/calendar", label: "Calendar" },
  w: { to: "/week", label: "Week" },
  r: { to: "/reminders", label: "Reminders" },
  e: { to: "/settings", label: "Settings" },
};

const ACTIONS: { keys: string; label: string }[] = [
  { keys: "c", label: "Capture (spending, a task, anything)" },
  { keys: "t", label: "New task" },
  { keys: "s", label: "New spending" },
  { keys: "Ctrl K", label: "Search everything" },
  { keys: "?", label: "This list" },
];

/** Asks the + button to open something (see QuickAdd). */
export function openQuick(kind: "capture" | "task" | "money") {
  window.dispatchEvent(new CustomEvent("life-os-quick", { detail: kind }));
}

function typing(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable;
}

/**
 * Keyboard shortcuts on a computer: single keys when you're not typing.
 * "g" then a letter jumps to a page; "?" lists everything.
 */
export function KeyboardShortcuts() {
  const navigate = useNavigate();
  const [help, setHelp] = useState(false);
  const pendingGo = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
      if (document.querySelector("[role=dialog]") && event.key !== "Escape") return;
      const key = event.key.toLowerCase();
      if (pendingGo.current != null) {
        window.clearTimeout(pendingGo.current);
        pendingGo.current = null;
        const page = GO[key];
        if (page) {
          event.preventDefault();
          void navigate({ to: page.to as never });
        }
        return;
      }
      if (key === "g") {
        pendingGo.current = window.setTimeout(() => (pendingGo.current = null), 1200);
      } else if (event.key === "?") {
        event.preventDefault();
        setHelp(true);
      } else if (key === "c") {
        event.preventDefault();
        openQuick("capture");
      } else if (key === "t") {
        event.preventDefault();
        openQuick("task");
      } else if (key === "s") {
        event.preventDefault();
        openQuick("money");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <Dialog open={help} onOpenChange={setHelp}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>When you're not typing in a box.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {ACTIONS.map((item) => (
            <div key={item.keys} className="contents">
              <dt>
                <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs">
                  {item.keys}
                </kbd>
              </dt>
              <dd className="text-muted-foreground">{item.label}</dd>
            </div>
          ))}
          {Object.entries(GO).map(([key, page]) => (
            <div key={key} className="contents">
              <dt>
                <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs">
                  g {key}
                </kbd>
              </dt>
              <dd className="text-muted-foreground">Go to {page.label}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
