import { Link, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";

import type { ModuleKey } from "@/data/modules";
import { useModules } from "@/hooks/useModules";

type SectionTab = {
  to:
    | "/dashboard"
    | "/week"
    | "/time"
    | "/tasks"
    | "/projects"
    | "/goals"
    | "/habits"
    | "/capabilities"
    | "/finance"
    | "/finance/transactions"
    | "/finance/recurring"
    | "/finance/categories"
    | "/resources"
    | "/health"
    | "/food";
  label: string;
  exact?: boolean;
  module?: ModuleKey;
};

const DO_TABS: SectionTab[] = [
  { to: "/tasks", label: "Tasks" },
  { to: "/projects", label: "Projects" },
  { to: "/goals", label: "Goals" },
  { to: "/habits", label: "Habits", module: "habits" },
  { to: "/capabilities", label: "Capabilities" },
];

const MONEY_TABS: SectionTab[] = [
  { to: "/finance", label: "Overview", exact: true },
  { to: "/finance/transactions", label: "Transactions" },
  { to: "/finance/recurring", label: "Recurring" },
  { to: "/finance/categories", label: "Categories" },
  { to: "/resources", label: "Resources", module: "resources" },
];

const TODAY_TABS: SectionTab[] = [
  { to: "/dashboard", label: "Today" },
  { to: "/week", label: "Week" },
  { to: "/time", label: "Time" },
];

const BODY_TABS: SectionTab[] = [
  { to: "/health", label: "Health" },
  { to: "/food", label: "Food", module: "food" },
];

function tabsFor(pathname: string) {
  if (TODAY_TABS.some((tab) => pathname.startsWith(tab.to)))
    return { label: "Today", tabs: TODAY_TABS };
  if (DO_TABS.some((tab) => pathname.startsWith(tab.to))) return { label: "Do", tabs: DO_TABS };
  if (pathname.startsWith("/finance") || pathname.startsWith("/resources")) {
    return { label: "Money", tabs: MONEY_TABS };
  }
  if (BODY_TABS.some((tab) => pathname.startsWith(tab.to)))
    return { label: "Body", tabs: BODY_TABS };
  return null;
}

export function SectionTabs() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { enabled } = useModules();
  const found = tabsFor(pathname);
  const listRef = useRef<HTMLElement>(null);
  // The underline slides from the previous tab to the new one, so it's clear
  // these are sibling pages of one section.
  const [bar, setBar] = useState<{ x: number; w: number; animate: boolean } | null>(null);
  const sectionRef = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return setBar(null);
    // Only slide between tabs of the same section; a new section just appears.
    const sameSection = sectionRef.current === found?.label;
    sectionRef.current = found?.label;
    const measure = (animate: boolean) => {
      const active = list.querySelector<HTMLElement>('[data-status="active"]');
      setBar(active ? { x: active.offsetLeft, w: active.offsetWidth, animate } : null);
    };
    measure(sameSection);
    list.querySelector('[data-status="active"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    // Widths change once the web font arrives and when the window resizes.
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(list);
    void document.fonts?.ready.then(() => measure(false));
    return () => observer.disconnect();
  }, [pathname, found?.label]);
  if (!found) return null;
  const section = {
    label: found.label,
    tabs: found.tabs.filter((tab) => !tab.module || enabled.includes(tab.module)),
  };
  if (section.tabs.length < 2) return null;

  return (
    <nav
      ref={listRef}
      className="relative mb-6 flex min-w-0 gap-1 overflow-x-auto border-b border-border [scrollbar-width:none] max-md:[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]"
      aria-label={`${section.label} sections`}
    >
      {bar ? (
        <span
          aria-hidden="true"
          className={`absolute bottom-0 left-0 h-0.5 rounded-full bg-primary ${bar.animate ? "transition-[translate,width] duration-250 ease-in-out" : ""}`}
          style={{ width: bar.w, translate: `${bar.x}px 0` }}
        />
      ) : null}
      {section.tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          activeOptions={{ exact: tab.exact ?? true }}
          className="shrink-0 px-3 pb-3 pt-2 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
