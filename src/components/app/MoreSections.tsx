import { Children, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const KEY = "life-os:more";

function remembered(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

type SectionProps = { id: string; title: string; summary?: string; children: ReactNode };

/** One extra part of a page. Only meaningful inside {@link MoreSections}. */
export function Section(_props: SectionProps): ReactElement | null {
  return null;
}

/**
 * The rest of a page, without a stack of drawers: a single row of names, and
 * only the one you pick is shown. Nothing is open until you choose, and the
 * choice is remembered per device.
 */
export function MoreSections({
  id,
  label = "More",
  children,
  className,
}: {
  /** Stable id; the chosen section is remembered under it. */
  id: string;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const sections = Children.toArray(children).filter(
    (child): child is ReactElement<SectionProps> =>
      isValidElement(child) && typeof (child.props as SectionProps)?.id === "string",
  );
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const saved = remembered()[id];
    if (saved && sections.some((section) => section.props.id === saved)) setActive(saved);
    // Only on mount: later changes come from taps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!sections.length) return null;

  const choose = (key: string) => {
    const next = active === key ? null : key;
    setActive(next);
    try {
      const all = remembered();
      if (next) all[id] = next;
      else delete all[id];
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      // Private mode: it just won't be remembered.
    }
  };

  const open = sections.find((section) => section.props.id === active);

  return (
    <section className={cn("min-w-0", className)} aria-label={label}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {sections.map((section) => {
          const selected = section.props.id === active;
          return (
            <button
              key={section.props.id}
              type="button"
              onClick={() => choose(section.props.id)}
              aria-pressed={selected}
              className={cn(
                "min-h-9 rounded-full border px-3.5 text-sm transition-[color,background-color,border-color,scale] duration-150 ease-out active:scale-[0.97]",
                selected
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {section.props.title}
            </button>
          );
        })}
      </div>
      {open ? (
        <div className="mt-4 animate-in fade-in slide-in-from-top-1 duration-200 ease-out">
          {open.props.children}
        </div>
      ) : null}
    </section>
  );
}
