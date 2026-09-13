import { Link } from "@tanstack/react-router";
import { LogOut, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

import { BottomNav, SidebarNav } from "@/components/app/Navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth, useSignOut } from "@/hooks/useAuth";

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

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col justify-between border-r border-border bg-sidebar px-3 py-6 md:flex">
        <div className="space-y-6">
          <Brand />
          <SidebarNav />
        </div>
        <div className="space-y-2 px-1">
          <p className="truncate px-2 text-xs text-muted-foreground">{user?.email}</p>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 px-3 py-6">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="space-y-6">
              <Brand />
              <SidebarNav onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <span className="text-sm font-semibold">Life OS</span>
        <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}>
          <LogOut className="size-5" />
        </Button>
      </header>

      <main className="px-4 pb-24 pt-6 md:ml-60 md:px-10 md:pb-12 md:pt-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>

      <BottomNav />
    </div>
  );
}
