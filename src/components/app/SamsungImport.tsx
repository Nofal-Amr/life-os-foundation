import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { HEALTH_KIND_LABELS, healthSampleKeys } from "@/data/healthSamples";
import { parseSamsungExport, type ImportResult } from "@/data/samsungExport";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { currentUserId } from "@/lib/supabase-helpers";
import { readZip } from "@/lib/zip";

/**
 * Imports a Samsung Health data download: the .zip, or the CSV files from
 * its folder. JSON files and pictures in the download are skipped.
 * Shows what was found before anything is saved.
 */
export function SamsungImport() {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function read(files: FileList) {
    setReading(true);
    setResult(null);
    try {
      const texts: { name: string; text: string }[] = [];
      for (const file of Array.from(files)) {
        const name = file.name.toLowerCase();
        if (name.endsWith(".zip")) {
          for (const entry of await readZip(await file.arrayBuffer())) {
            if (entry.name.toLowerCase().endsWith(".csv")) {
              texts.push({ name: entry.name, text: await entry.text() });
            }
          }
        } else if (name.endsWith(".csv")) {
          texts.push({ name: file.name, text: await file.text() });
        }
      }
      if (!texts.length)
        throw new Error("No CSV files found. Pick the .zip or the CSV files inside it.");
      const parsed = parseSamsungExport(texts);
      if (!parsed.samples.length) {
        throw new Error(
          "None of those files had steps, sleep, heart rate, weight or workouts. Pick the files whose names start with com.samsung.",
        );
      }
      setResult(parsed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't read those files.");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function save() {
    if (!result) return;
    setSaving(true);
    try {
      const user_id = await currentUserId();
      const rows = result.samples.map((sample) => ({ ...sample, user_id }));
      for (let index = 0; index < rows.length; index += 500) {
        const { error } = await supabase
          .from("health_samples")
          .upsert(rows.slice(index, index + 500), { onConflict: "user_id,kind,external_id" });
        if (error) throw error;
      }
      track("samsung_import", { rows: rows.length });
      toast.success(`Imported ${rows.length.toLocaleString()} entries from Samsung Health.`);
      setResult(null);
      void queryClient.invalidateQueries({ queryKey: healthSampleKeys.all });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the import.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">Import your Samsung Health history</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            From Samsung Health → Settings → Download personal data. Pick the .zip, or select all
            the CSV files in the folder. JSON files and pictures are skipped.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={reading || saving}
          onClick={() => input.current?.click()}
        >
          <Upload className="size-4" />
          {reading ? "Reading…" : "Choose files"}
        </Button>
        <input
          ref={input}
          type="file"
          // No accept filter: phones often label Samsung CSVs with a generic type,
          // which a filter would grey out. Files are checked by name instead.
          multiple
          className="hidden"
          onChange={(event) => event.target.files?.length && void read(event.target.files)}
        />
      </div>

      {result ? (
        <div className="space-y-3 rounded-lg bg-secondary p-3">
          <p className="font-medium">Found in your download</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
            {Object.entries(result.counts).map(([kind, count]) => (
              <li key={kind} className="flex justify-between gap-2">
                <span>{HEALTH_KIND_LABELS[kind as keyof typeof HEALTH_KIND_LABELS]}</span>
                <span className="tabular-nums text-muted-foreground">
                  {count.toLocaleString()}{" "}
                  {kind === "steps" || kind === "heart_rate" ? "days" : "entries"}
                </span>
              </li>
            ))}
          </ul>
          {result.from && result.to ? (
            <p className="text-xs text-muted-foreground">
              {format(new Date(result.from), "d MMM yyyy")} –{" "}
              {format(new Date(result.to), "d MMM yyyy")} · from {result.files.length}{" "}
              {result.files.length === 1 ? "file" : "files"}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? "Importing…" : `Import ${result.samples.length.toLocaleString()} entries`}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => setResult(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
