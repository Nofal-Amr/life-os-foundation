import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { analyticsEnabled, setAnalyticsEnabled } from "@/lib/analytics";

type Row = {
  name: string;
  props: { screen?: string; seconds?: number } | null;
  platform: string | null;
};

/** What the private usage log shows, so the app can be refined from real use. */
export function UsageInsights() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(analyticsEnabled()), []);

  const events = useQuery({
    queryKey: ["ux_events", 30],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ux_events")
        .select("name, props, platform")
        .gte("created_at", addDays(new Date(), -30).toISOString())
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = events.data ?? [];
  const screens = new Map<string, { views: number; seconds: number[] }>();
  const actions = new Map<string, number>();
  for (const row of rows) {
    if (row.name === "screen" && row.props?.screen) {
      const entry = screens.get(row.props.screen) ?? { views: 0, seconds: [] };
      entry.views += 1;
      screens.set(row.props.screen, entry);
    } else if (row.name === "screen_time" && row.props?.screen && row.props.seconds != null) {
      const entry = screens.get(row.props.screen) ?? { views: 0, seconds: [] };
      entry.seconds.push(row.props.seconds);
      screens.set(row.props.screen, entry);
    } else if (row.name !== "screen" && row.name !== "screen_time") {
      actions.set(row.name, (actions.get(row.name) ?? 0) + 1);
    }
  }
  const median = (values: number[]) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)]!;
  };
  const topScreens = [...screens.entries()].sort((a, b) => b[1].views - a[1].views).slice(0, 8);
  const topActions = [...actions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <Card className="system-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">How you use Life OS</CardTitle>
            <CardDescription>
              Private: screens and actions are logged only to your own account, to find what takes
              too many taps. Nothing leaves your Supabase.
            </CardDescription>
          </div>
          <Switch
            checked={on}
            aria-label="Usage log"
            onCheckedChange={(value) => {
              setOn(value);
              setAnalyticsEnabled(value);
            }}
          />
        </div>
      </CardHeader>
      <CardContent>
        {events.error ? (
          <p className="text-sm text-muted-foreground">
            Run the latest SQL migration to start the usage log.
          </p>
        ) : !rows.length ? (
          <p className="text-sm text-muted-foreground">Nothing logged in the last 30 days yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Screens · 30 days
              </p>
              <ul className="space-y-1 text-sm">
                {topScreens.map(([screen, stats]) => (
                  <li key={screen} className="flex justify-between gap-3">
                    <span className="truncate">{screen}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {stats.views} views
                      {median(stats.seconds) != null ? ` · ${median(stats.seconds)} s typical` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Actions · 30 days
              </p>
              <ul className="space-y-1 text-sm">
                {topActions.length ? (
                  topActions.map(([name, count]) => (
                    <li key={name} className="flex justify-between gap-3">
                      <span className="truncate">{name.replace(/_/g, " ")}</span>
                      <span className="tabular-nums text-muted-foreground">{count}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-muted-foreground">No actions yet.</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
