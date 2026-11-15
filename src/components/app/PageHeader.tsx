import type { ReactNode } from "react";

import { t } from "@/lib/i18n";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold sm:text-[1.75rem] leading-tight tracking-[-0.025em] text-foreground">
          {t(title)}
        </h1>
        {description ? (
          <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">{t(description)}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
