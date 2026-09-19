import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  HeartPulse,
  LayoutDashboard,
  Moon,
  NotebookPen,
  Sunset,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const NAV_ITEMS = [
  { to: "/dashboard", label: "Today", icon: LayoutDashboard },
  { to: "/tasks", label: "Do", icon: CheckSquare },
  { to: "/finance", label: "Money", icon: Wallet },
  { to: "/health", label: "Body", icon: HeartPulse },
  { to: "/spirit", label: "Spirit", icon: Moon },
] as const;

const SECTION_ITEMS = {
  "/tasks": [
    { to: "/tasks" as const, label: "Tasks" },
    { to: "/projects" as const, label: "Projects" },
    { to: "/goals" as const, label: "Goals" },
    { to: "/habits" as const, label: "Habits" },
    { to: "/capabilities" as const, label: "Capabilities" },
  ],
  "/finance": [
    { to: "/finance" as const, label: "Overview" },
    { to: "/finance/transactions" as const, label: "Transactions" },
    { to: "/finance/recurring" as const, label: "Recurring costs" },
    { to: "/finance/categories" as const, label: "Categories" },
    { to: "/resources" as const, label: "Resources" },
  ],
  "/health": [
    { to: "/health" as const, label: "Health & medications" },
    { to: "/food" as const, label: "Food" },
  ],
} as const;

const TOOLS = [
  { to: "/calendar" as const, label: "Calendar", icon: CalendarDays },
  { to: "/notes" as const, label: "Notes", icon: NotebookPen },
  { to: "/review" as const, label: "Daily review", icon: Sunset },
];

function sectionFor(pathname: string) {
  if (["/tasks", "/projects", "/goals", "/habits", "/capabilities"].some((path) => pathname.startsWith(path))) return "/tasks";
  if (pathname.startsWith("/finance") || pathname.startsWith("/resources")) return "/finance";
  if (pathname.startsWith("/health") || pathname.startsWith("/food")) return "/health";
  return null;
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeSection = sectionFor(pathname);
  const [openSection, setOpenSection] = useState<string | null>(activeSection);
  const onToolRoute = TOOLS.some((item) => pathname.startsWith(item.to));
  const [toolsOpen, setToolsOpen] = useState(onToolRoute);

  useEffect(() => {
    if (activeSection) setOpenSection(activeSection);
    if (onToolRoute) setToolsOpen(true);
  }, [activeSection, onToolRoute]);

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <div key={to} className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            <Link
              to={to}
              onClick={onNavigate}
              activeOptions={{ exact: true }}
              aria-current={pathname === to || activeSection === to ? "page" : undefined}
              className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground ${pathname === to || activeSection === to ? "bg-accent font-medium text-foreground" : "text-muted-foreground"}`}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </Link>
            {to in SECTION_ITEMS ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-expanded={openSection === to}
                aria-controls={`${label.toLowerCase()}-submenu`}
                aria-label={openSection === to ? `Hide ${label} pages` : `Show ${label} pages`}
                onClick={() => setOpenSection((current) => current === to ? null : to)}
                className="size-9 shrink-0 text-muted-foreground"
              >
                <ChevronRight
                  className={`size-4 transition-transform ${openSection === to ? "rotate-90" : ""}`}
                  aria-hidden="true"
                />
              </Button>
            ) : null}
          </div>
          {to in SECTION_ITEMS && openSection === to ? (
            <div id={`${label.toLowerCase()}-submenu`} className="ml-7 mt-1 space-y-0.5 border-l border-border pl-2">
              {SECTION_ITEMS[to as keyof typeof SECTION_ITEMS].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/finance" }}
                  onClick={onNavigate}
                  className="block truncate rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ))}
      <div className="mt-3 border-t border-border pt-3">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-between px-3 text-muted-foreground"
          aria-expanded={toolsOpen}
          aria-controls="tools-submenu"
          onClick={() => setToolsOpen((current) => !current)}
        >
          <span className="flex items-center gap-3"><Activity className="size-4" />Tools</span>
          <ChevronRight className={`size-4 transition-transform ${toolsOpen ? "rotate-90" : ""}`} />
        </Button>
        {toolsOpen ? (
          <div id="tools-submenu" className="ml-7 mt-1 space-y-0.5 border-l border-border pl-2">
            {TOOLS.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} onClick={onNavigate} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground">
                <Icon className="size-3.5" />{label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}

export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeSection = sectionFor(pathname);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              aria-current={pathname === to || activeSection === to ? "page" : undefined}
              className={`flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] transition-colors ${pathname === to || activeSection === to ? "font-medium text-primary" : "text-muted-foreground"}`}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
