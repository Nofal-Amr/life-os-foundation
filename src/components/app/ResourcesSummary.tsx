import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";

import { meterFacts, quotaFacts, resourceReadingsQuery, resourcesQuery } from "@/data/resources";
import { cn } from "@/lib/utils";

const round = (value: number) => String(Math.round(value * 100) / 100);

/**
 * Home and bills, in one line each, on the Money page: meters and balances
 * are money you have already committed. Tapping goes to Resources.
 */
export function ResourcesSummary({ className }: { className?: string }) {
  const resources = useQuery(resourcesQuery());
  const readings = useQuery(resourceReadingsQuery());

  const rows = (resources.data ?? [])
    .filter((resource) => resource.active)
    .map((resource) => {
      const all = readings.data ?? [];
      if (resource.kind === "quota") {
        const facts = quotaFacts(resource, all);
        if (!facts) return null;
        return {
          id: resource.id,
          name: resource.name,
          value: `${round(facts.remaining)} ${resource.unit} left`,
          detail:
            facts.daysLeft == null
              ? "add readings on a few days to see how long it lasts"
              : facts.daysLeft < 1
                ? "less than a day at this rate"
                : `about ${Math.floor(facts.daysLeft)} ${Math.floor(facts.daysLeft) === 1 ? "day" : "days"} at this rate`,
        };
      }
      const facts = meterFacts(resource, all);
      if (!facts) return null;
      return {
        id: resource.id,
        name: resource.name,
        value: `${round(facts.cycleConsumption ?? 0)} ${resource.unit} this month`,
        detail:
          facts.tier?.until != null
            ? `${Math.ceil(facts.tier.until.kwh)} ${resource.unit} until tier ${facts.tier.until.next}`
            : facts.perDay != null
              ? `${round(facts.perDay)} ${resource.unit} a day`
              : "",
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .slice(0, 3);

  if (!rows.length) return null;

  return (
    <section className={cn("min-w-0", className)} aria-label="Home and bills">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="section-title">Home and bills</h2>
        <Link to="/resources" className="text-xs text-muted-foreground hover:text-foreground">
          All meters
        </Link>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              to="/resources"
              className="system-card flex min-h-14 items-center gap-3 px-4 py-2 transition-colors duration-150 hover:bg-accent"
            >
              <Zap className="size-[18px] shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
              <span className="shrink-0 text-right">
                <span className="block text-sm tabular-nums">{row.value}</span>
                {row.detail ? (
                  <span className="block text-xs text-muted-foreground">{row.detail}</span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
