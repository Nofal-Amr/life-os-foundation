import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { exitDemo, isDemo, resetDemo, startDemo } from "@/lib/demo";

/** Shown on every page in demo mode: what it is, and how to leave. */
export function DemoBanner() {
  if (!isDemo()) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border bg-primary/10 px-4 py-1 text-xs md:ms-60">
      <span className="flex items-center gap-2">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden="true" />
        <span
          className="truncate"
          title={t("Sample data, no account. Changes stay in this browser.")}
        >
          {t("Demo")}
        </span>
      </span>
      <span className="flex shrink-0 gap-1">
        <Button type="button" size="sm" variant="ghost" className="h-7" onClick={resetDemo}>
          {t("Reset demo")}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7" onClick={exitDemo}>
          {t("Exit demo")}
        </Button>
      </span>
    </div>
  );
}

/** "Try the demo" on the start and sign-in pages. */
export function TryDemoButton({ className }: { className?: string }) {
  return (
    <Button type="button" variant="outline" size="lg" className={className} onClick={startDemo}>
      <FlaskConical className="size-4" aria-hidden="true" />
      {t("Try the demo")}
    </Button>
  );
}
