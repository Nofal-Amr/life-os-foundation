import { Link, useRouterState } from "@tanstack/react-router";

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
  if (!found) return null;
  const section = {
    label: found.label,
    tabs: found.tabs.filter((tab) => !tab.module || enabled.includes(tab.module)),
  };
  if (section.tabs.length < 2) return null;

  return (
    <nav
      className="mb-6 flex min-w-0 gap-1 overflow-x-auto border-b border-border pb-2"
      aria-label={`${section.label} sections`}
    >
      {section.tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          activeOptions={{ exact: tab.exact ?? true }}
          className="shrink-0 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:font-medium data-[status=active]:text-foreground"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
