import { Link } from "@tanstack/react-router";
import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { SyncIndicator } from "./SyncIndicator";
import { useState, type ReactNode } from "react";

import { BottomNav, SidebarNav } from "@/components/app/Navigation";
import { SectionTabs } from "@/components/app/SectionTabs";
import { UserAvatar, useDisplayName } from "@/components/app/UserAvatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  const [open, setOpen] = useState(false);
  const signOut = useSignOut();
  const { user } = useAuth();
  const { displayName } = useDisplayName();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
       <aside className="fixed inset-y-0 left-0 hidden w-60 min-w-0 flex-col justify-between overflow-y-auto border-r border-border bg-sidebar px-3 py-6 md:flex">
        <div className="space-y-6">
          <Brand />
          <SidebarNav />
        </div>
        <div className="space-y-2 px-1">
          <SyncIndicator />
          <Link to="/settings" className="flex items-center gap-2 rounded-lg px-1 py-2 hover:bg-accent">
            <UserAvatar size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
          </Link>
           <Button variant="ghost" size="sm" className="w-full justify-start" onClick={toggleTheme}>
             {theme === "dark" ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
             {theme === "dark" ? "Light theme" : "Dark theme"}
           </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>

      </aside>

       <header className="sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col justify-between overflow-y-auto px-3 py-6">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="space-y-6">
              <Brand />
              <SidebarNav onNavigate={() => setOpen(false)} />
            </div>
            <div className="mt-6 space-y-2 px-1">
              <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-1 py-2 hover:bg-accent">
                <UserAvatar size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{displayName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
                </div>
              </Link>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={toggleTheme}>
                {theme === "dark" ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
                {theme === "dark" ? "Light theme" : "Dark theme"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
              >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </Button>
            </div>
          </SheetContent>

        </Sheet>
         <div className="flex min-w-0 flex-col items-center">
           <span className="truncate text-center text-sm font-semibold">Life OS</span>
           <SyncIndicator className="mt-0.5" />
         </div>
         <Button variant="ghost" size="icon" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={toggleTheme}>
           {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
         </Button>
      </header>

       <main className="min-w-0 overflow-x-clip px-4 pb-28 pt-6 md:ml-60 md:px-6 md:pb-12 md:pt-8 lg:px-10">
          <div className="mx-auto w-full min-w-0 max-w-6xl">
            <SectionTabs />
            {children}
          </div>
      </main>

      <BottomNav />
    </div>
  );
}
