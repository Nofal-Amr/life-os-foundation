import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckSquare,
  FolderKanban,
  HeartPulse,
  LayoutDashboard,
  Moon,
  NotebookPen,
  Repeat,
  Settings,
  Sparkles,
  Sunset,
  Target,
  Wallet,
} from "lucide-react";

export const NAV_ITEMS = [
  { to: "/dashboard", label: "Today", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/habits", label: "Habits", icon: Repeat },
  { to: "/finance", label: "Money", icon: Wallet },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/health", label: "Health", icon: HeartPulse },
  { to: "/spirit", label: "Spirit", icon: Moon },
  { to: "/capabilities", label: "Capabilities", icon: Sparkles },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/review", label: "Review", icon: Sunset },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const MONEY_ITEMS = [
  { to: "/finance" as const, label: "Overview" },
  { to: "/finance/transactions" as const, label: "Transactions" },
  { to: "/finance/recurring" as const, label: "Recurring costs" },
  { to: "/finance/categories" as const, label: "Categories" },
];



export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <div key={to} className="min-w-0">
          <Link
            to={to}
            onClick={onNavigate}
            activeOptions={{ exact: to === "/finance" }}
            className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:font-medium data-[status=active]:text-foreground"
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Link>
          {to === "/finance" ? (
            <div className="ml-7 mt-1 space-y-0.5 border-l border-border pl-2">
              {MONEY_ITEMS.map((item) => (
                <Link key={item.to} to={item.to} activeOptions={{ exact: item.to === "/finance" }} onClick={onNavigate} className="block truncate rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground">
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </nav>
  );
}

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.slice(0, 5).map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] text-muted-foreground transition-colors data-[status=active]:text-primary"
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
