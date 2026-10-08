import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Download, HardDriveDownload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { createBackup, readBackup, restoreBackup, type Backup } from "@/data/backup";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XLSX_MIME, exportEverything } from "@/data/exportData";
import { saveFile } from "@/lib/native";

/** Everything you've logged, as one Excel file you keep. */
export function ExportDataCard() {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [toRestore, setToRestore] = useState<Backup | null>(null);

  const backup = useMutation({
    mutationFn: async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("A backup reads fresh from the server, so it needs a connection.");
      }
      const { backup: data, rows } = await createBackup();
      const json = new TextEncoder().encode(JSON.stringify(data));
      const name = `Life OS backup ${format(new Date(), "yyyy-MM-dd")}.json`;
      const where = saveFile(name, json, "application/json");
      if (!where) throw new Error("The file couldn't be saved on this device.");
      return { rows, where, name };
    },
    onSuccess: ({ rows, where, name }) =>
      toast.success(`${name} saved to ${where}`, {
        description: `${rows.toLocaleString()} rows. Keep it somewhere safe.`,
      }),
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "The backup didn't finish."),
  });

  const restore = useMutation({
    mutationFn: (data: Backup) => restoreBackup(data),
    onSuccess: ({ rows, skipped }) => {
      void queryClient.invalidateQueries();
      if (skipped.length) {
        toast.warning(`Restored ${rows.toLocaleString()} rows; some couldn't be.`, {
          description: skipped.slice(0, 3).join(" · "),
        });
      } else {
        toast.success(`Restored ${rows.toLocaleString()} rows.`);
      }
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "The restore didn't finish."),
  });

  const run = useMutation({
    mutationFn: async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Exporting reads fresh from the server, so it needs a connection.");
      }
      const { bytes, rows } = await exportEverything();
      const name = `Life OS ${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      const where = saveFile(name, bytes, XLSX_MIME);
      if (!where) throw new Error("The file couldn't be saved on this device.");
      return { rows, where, name };
    },
    onSuccess: ({ rows, where, name }) =>
      toast.success(`${name} saved to ${where}`, {
        description: `${rows.toLocaleString()} rows, one sheet per area.`,
      }),
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "The export didn't finish."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your data</CardTitle>
        <CardDescription>
          Download everything you've logged as an Excel file: tasks, money, habits, food, health,
          prayers, time, notes and readings, one sheet each. It's yours to keep or analyse.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          disabled={run.isPending}
          onClick={() => run.mutate()}
        >
          <Download className="size-4" aria-hidden="true" />
          {run.isPending ? "Preparing…" : "Export to Excel"}
        </Button>
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            A full backup is one file with everything, that Life OS can read back: if you change
            phones, or want a copy before a big change.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={backup.isPending}
              onClick={() => backup.mutate()}
            >
              <HardDriveDownload className="size-4" aria-hidden="true" />
              {backup.isPending ? "Backing up…" : "Back up everything"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={restore.isPending}
              onClick={() => fileInput.current?.click()}
            >
              <ArchiveRestore className="size-4" aria-hidden="true" />
              {restore.isPending ? "Restoring…" : "Restore a backup"}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const result = readBackup(await file.text());
                if (typeof result === "string") toast.error(result);
                else setToRestore(result);
              }}
            />
          </div>
        </div>
        <ConfirmDialog
          open={toRestore != null}
          onOpenChange={(open) => !open && setToRestore(null)}
          title="Restore this backup?"
          description={
            toRestore
              ? `From ${format(new Date(toRestore.createdAt), "d MMM yyyy, HH:mm")}. Rows in it are written back as they were then; anything you added since stays. Nothing is deleted.`
              : ""
          }
          onConfirm={() => {
            if (toRestore) restore.mutate(toRestore);
            setToRestore(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
