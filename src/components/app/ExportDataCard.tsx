import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XLSX_MIME, exportEverything } from "@/data/exportData";
import { saveFile } from "@/lib/native";

/** Everything you've logged, as one Excel file you keep. */
export function ExportDataCard() {
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
      </CardContent>
    </Card>
  );
}
