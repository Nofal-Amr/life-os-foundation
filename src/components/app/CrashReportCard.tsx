import { Bug, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { clearCrashReport, crashReport, type CrashReport } from "@/lib/native";

/**
 * Android only: if Life OS crashed or froze, shows what Android recorded so it
 * can be copied and sent on. Nothing is sent by itself. Hidden when there's
 * nothing to show.
 */
export function CrashReportCard() {
  const [report, setReport] = useState<CrashReport | null>(() => crashReport());
  if (!report || (!report.crash && !report.notes && report.exits.length === 0)) return null;

  const text = [
    `Life OS on ${report.device}`,
    ...report.exits.map(
      (exit) =>
        `${new Date(exit.at).toLocaleString()} — ${exit.reason}${exit.description ? `: ${exit.description}` : ""}${exit.trace ? `\n${exit.trace}` : ""}`,
    ),
    report.crash ? `\nLast crash:\n${report.crash}` : "",
    report.notes ? `\nNotes:\n${report.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied. Paste it into a message to send it on.");
    } catch {
      toast.error("Couldn't copy. Long-press the text to select it.");
    }
  };

  return (
    <section className="stat-card space-y-3 p-5">
      <div>
        <p className="flex items-center gap-2 text-base font-semibold">
          <Bug className="size-4" /> Recent app stops
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Life OS stopped unexpectedly on this phone. Copy this and send it on so it can be fixed.
          It stays on this phone unless you share it.
        </p>
      </div>
      <ul className="space-y-1 text-sm">
        {report.exits.slice(0, 4).map((exit) => (
          <li key={`${exit.at}-${exit.reason}`} className="flex justify-between gap-3">
            <span>{exit.reason}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {new Date(exit.at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-secondary p-3 text-2xs text-muted-foreground">
        {text}
      </pre>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
          <Copy className="size-4" /> Copy report
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            clearCrashReport();
            setReport(crashReport());
          }}
        >
          Clear saved crash
        </Button>
      </div>
    </section>
  );
}
