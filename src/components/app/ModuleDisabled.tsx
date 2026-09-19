import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { MODULES, type ModuleKey } from "@/data/modules";
import { useModules } from "@/hooks/useModules";

/** Shown when a page belongs to a module the user switched off. */
export function ModuleDisabled({ module }: { module: ModuleKey }) {
  const { toggleModule, isSaving } = useModules();
  const entry = MODULES.find((item) => item.key === module);

  return (
    <>
      <PageHeader
        title={`${entry?.label ?? module} is switched off`}
        description={entry?.description ?? "This part of Life OS is currently hidden."}
      />
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Nothing was deleted. Turn it back on whenever you want it.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            className="min-h-11"
            disabled={isSaving}
            onClick={() => toggleModule(module, true)}
          >
            {isSaving ? "Turning on…" : `Turn ${entry?.label ?? module} back on`}
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/dashboard">Back to Today</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
