import { Link, useRouterState } from "@tanstack/react-router";
import { Bell,
  CalendarDays,
  CheckSquare,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  NotebookPen,
  Sun,
  Sunset,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useSignOut } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import type { ModuleKey } from "@/data/modules";
import { useModules } from "@/hooks/useModules";

export const NAV_ITEMS = [
  { to: "/dashboard", label: "Today", icon: LayoutDashboard, module: null },
  { to: "/tasks", label: "Do", icon: CheckSquare, module: "do" },
  { to: "/finance", label: "Money", icon: Wallet, module: "money" },
  { to: "/health", label: "Body", icon: HeartPulse, module: "body" },
  { to: "/spirit", label: "Spirit", icon: Moon, module: "spirit" },
] as const;

const TOOLS = [
  { to: "/calendar" as const, label: "Calendar", icon: CalendarDays, module: "calendar" as const },
  { to: "/notes" as const, label: "Notes", icon: NotebookPen, module: "notes" as const },
  { to: "/reminders" as const, label: "Reminders", icon: Bell, module: null },
  { to: "/review" as const, label: "Daily review", icon: Sunset, module: null },
];

function sectionFor(pathname: string) {
  if (["/dashboard", "/week", "/time"].some((path) => pathname.startsWith(path)))
    return "/dashboard";
  if (
    ["/tasks", "/projects", "/goals", "/habits", "/capabilities"].some((path) =>
      pathname.startsWith(path),
    )
  )
    return "/tasks";
  if (pathname.startsWith("/finance") || pathname.startsWith("/resources")) return "/finance";
  if (pathname.startsWith("/health") || pathname.startsWith("/food")) return "/health";
  return null;
}

/** Only the modules this user kept are shown; the structure is unchanged. */
function useVisible() {
  const { enabled } = useModules();
  const allows = (module: ModuleKey | null) => !module || enabled.includes(module);
  return {
    navItems: NAV_ITEMS.filter((item) => allows(item.module as ModuleKey | null)),
    tools: TOOLS.filter((item) => allows(item.module)),
  };
}

const itemClass = (active: boolean) =>
  `group flex min-h-10 min-w-0 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150 hover:bg-accent hover:text-foreground ${
    active ? "bg-accent font-medium text-foreground" : "text-muted-foreground"
  }`;

const iconClass = (active: boolean) =>
  `size-[18px] shrink-0 transition-colors duration-150 ${active ? "text-primary" : ""}`;

/**
 * The desktop side menu: the five sections, then tools. Pages inside a
 * section are the tabs at the top of the page, so they aren't repeated here.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { navItems, tools } = useVisible();
  const activeSection = sectionFor(pathname);

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Sections">
      {navItems.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || activeSection === to;
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={itemClass(active)}
          >
            <Icon className={iconClass(active)} strokeWidth={1.75} aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
      {tools.length ? <ToolLinks onNavigate={onNavigate} className="mt-4 border-t border-border pt-4" /> : null}
    </nav>
  );
}

function ToolLinks({
  onNavigate,
  className,
}: {
  onNavigate?: (() => void) | undefined;
  className?: string;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { tools } = useVisible();
  return (
    <div className={className}>
      <p className="mb-1 px-3 text-xs font-medium text-muted-foreground">Tools</p>
      <div className="flex flex-col gap-0.5">
        {tools.map(({ to, label, icon: Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={itemClass(active)}
            >
              <Icon className={iconClass(active)} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { navItems, tools } = useVisible();
  const activeSection = sectionFor(pathname);
  const [moreOpen, setMoreOpen] = useState(false);
  const signOut = useSignOut();
  const { theme, toggleTheme } = useTheme();
  // "More" is active on pages that only the side menu lists (tools, settings).
  const onMoreRoute =
    pathname.startsWith("/settings") || tools.some((item) => pathname.startsWith(item.to));
  const tab = (active: boolean) =>
    `relative flex w-full flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-xs transition-colors duration-150 active:scale-[0.96] ${
      active ? "font-medium text-foreground" : "text-muted-foreground"
    }`;
  const indicator = (
    <span
      className="absolute top-0 h-0.5 w-5 rounded-full bg-primary animate-in fade-in zoom-in-50 duration-200 ease-out"
      aria-hidden="true"
    />
  );
  return (
    <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 md:hidden" aria-label="Sections">
      <ul
        className="system-dock grid overflow-hidden px-1"
        style={{ gridTemplateColumns: `repeat(${navItems.length + 1}, minmax(0, 1fr))` }}
      >
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || activeSection === to;
          return (
            <li key={to}>
              <Link to={to} aria-current={active ? "page" : undefined} className={tab(active)}>
                {active ? indicator : null}
                <Icon
                  className={`size-5 ${active ? "text-primary" : ""}`}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-current={onMoreRoute ? "page" : undefined}
            className={tab(onMoreRoute)}
          >
            {onMoreRoute ? indicator : null}
            <Menu
              className={`size-5 ${onMoreRoute ? "text-primary" : ""}`}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            More
          </button>
        </li>
      </ul>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-3xl px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5"
        >
          <SheetTitle className="sr-only">More</SheetTitle>
          {tools.length ? <ToolLinks onNavigate={() => setMoreOpen(false)} /> : null}
          <div className="mt-4 flex flex-col gap-0.5 border-t border-border pt-4">
            <button type="button" onClick={toggleTheme} className={itemClass(false)}>
              {theme === "dark" ? (
                <Sun className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Moon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
              )}
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                signOut();
              }}
              className={itemClass(false)}
            >
              <LogOut className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
