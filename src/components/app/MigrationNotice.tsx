import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getMissingColumns, onMissingColumns } from "@/lib/supabase-helpers";

/** What each new column powers, in plain words. */
const FEATURES: Record<string, string> = {
  status: "prayer status (jamaah, late, missed)",
  week_start: "week start day",
  skin: "the RPG skin",
  pinned: "pinned notes",
  archived: "archived notes",
  color: "note colours",
  checklist: "checklists",
  occurred_time: "times on money entries",
  tariff: "electricity tiers",
  counts_toward_spendable: "accounts kept separate",
};

const MIGRATION_FILE = "supabase/migrations/20260921140000_week_prayers_notes_health_skins.sql";

/**
 * Shown when the database is missing columns this version uses, so saves
 * that drop a field never look like they worked.
 */
export function MigrationNotice() {
  const [missing, setMissing] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const refresh = () => setMissing(getMissingColumns());
    refresh();
    const stop = onMissingColumns(refresh);
    // One cheap check per session: does the newest column exist?
    void supabase
      .from("prayer_logs")
      .select("status")
      .limit(1)
      .then(({ error }) => {
        if (error?.code === "42703")
          setMissing((current) => [...new Set([...current, "status", "week_start", "skin"])]);
      });
    return () => void stop();
  }, []);

  if (hidden || !missing.length) return null;
  const features = [...new Set(missing.map((column) => FEATURES[column] ?? column))];

  return (
    <div
      role="status"
      className="tone-warning mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">Your database needs a one-time update</p>
        <p>
          Until it's done, these can't be saved: {features.join(", ")}. Run{" "}
          <code className="break-all rounded bg-foreground/10 px-1 text-xs">{MIGRATION_FILE}</code>{" "}
          in Supabase → SQL Editor, then reload.
        </p>
      </div>
      <button type="button" aria-label="Hide for now" onClick={() => setHidden(true)}>
        <X className="size-4" />
      </button>
    </div>
  );
}
