import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, Moon, Sun } from "lucide-react";
import { SyncIndicator } from "./SyncIndicator";
import { MigrationNotice } from "./MigrationNotice";
import { TimerBar, useTimer } from "./Timer";
import { QuickAdd } from "./QuickAdd";
import { useReminderSync } from "./PrayerReminders";
import { trackScreen } from "@/lib/analytics";
import { useEffect, type ReactNode } from "react";

import { BottomNav, SidebarNav } from "@/components/app/Navigation";
import { SectionTabs } from "@/components/app/SectionTabs";
import { UserAvatar, useDisplayName } from "@/components/app/UserAvatar";
import { Button } from "@/components/ui/button";
import { useAuth, useSignOut } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

function Brand() {
  return (
    <Link to="/dashboard" className="block px-3 py-1">
      <span className="text-sm font-semibold tracking-tight text-foreground">Life OS</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">Personal operating system</span>
    </Link>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const signOut = useSignOut();
  const { user } = useAuth();
  const { displayName } = useDisplayName();
  const { theme, toggleTheme } = useTheme();
  useReminderSync();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => trackScreen(pathname), [pathname]);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 min-w-0 flex-col justify-between overflow-y-auto border-r border-border bg-sidebar px-3 py-6 md:flex">
        <div className="space-y-6">
          <Brand />
          <SidebarNav />
        </div>
        <div className="space-y-2 px-1">
          <SyncIndicator />
          <Link
            to="/settings"
            className="flex items-center gap-2 rounded-lg px-1 py-2 hover:bg-accent"
          >
            <UserAvatar size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </Link>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={toggleTheme}>
            {theme === "dark" ? (
              <Sun className="size-4" aria-hidden="true" />
            ) : (
              <Moon className="size-4" aria-hidden="true" />
            )}
            {theme === "dark" ? "Light theme" : "Dark theme"}
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Phones: one menu, under "More" in the bottom bar. The header only orients. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-2 backdrop-blur-md md:hidden">
        <Link to="/dashboard" className="flex min-w-0 flex-col py-1">
          <span className="truncate text-sm font-semibold tracking-tight">Life OS</span>
          <SyncIndicator />
        </Link>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
          {/* Your picture opens Profile & Settings, as in most phone apps. */}
          <Link
            to="/settings"
            aria-label="Profile and settings"
            className="ml-1 flex size-10 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-95"
          >
            <UserAvatar size="sm" />
          </Link>
        </div>
      </header>

      <main className="min-w-0 overflow-x-clip px-4 pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+11.5rem)] pt-6 md:ml-60 md:px-6 md:pb-12 md:pt-8 lg:px-10">
        <div className="mx-auto w-full min-w-0 max-w-6xl">
          <MigrationNotice />
          <TimerBar />
          <SectionTabs />
          {/* Keyed by page, so each page eases in instead of snapping. */}
          <div
            key={pathname}
            className="animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out"
          >
            {children}
            <TimerSpacer />
          </div>
        </div>
      </main>

      <QuickAdd />

      <BottomNav />
    </div>
  );
}

/** Room at the bottom of a page while the timer bar is showing (phones). */
function TimerSpacer() {
  const { running } = useTimer();
  return running ? <div className="h-20 md:hidden" aria-hidden="true" /> : null;
}
