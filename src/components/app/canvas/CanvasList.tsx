import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { GitFork, LayoutDashboard } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import {
  createCanvas,
  dayCanvasId,
  dayCanvasOn,
  dayCanvasStart,
  isCanvasNote,
  mindMapStart,
  parseCanvas,
  CANVAS_DAY_PREFIX,
} from "@/data/canvas";
import { dailyNoteOn, dailyTitle } from "@/data/dailyNotes";
import { noteKeys, notesQuery, type Note } from "@/data/notes";
import { useT } from "@/lib/i18n";

function putNote(queryClient: ReturnType<typeof useQueryClient>, note: Note) {
  queryClient.setQueryData<Note[]>(noteKeys.all, (rows = []) => [
    note,
    ...rows.filter((row) => row.id !== note.id),
  ]);
}

/** Your canvases, newest first, and the two ways to start one. */
export function CanvasList() {
  const t = useT();
  const notes = useQuery(notesQuery());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const canvases = useMemo(
    () =>
      (notes.data ?? [])
        .filter(isCanvasNote)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [notes.data],
  );

  async function start(kind: "canvas" | "mindmap") {
    if (busy) return;
    setBusy(true);
    try {
      const note = await createCanvas(
        kind === "mindmap" ? t("Mind map") : t("Untitled canvas"),
        kind === "mindmap" ? mindMapStart(t("Main idea")) : undefined,
      );
      putNote(queryClient, note);
      void navigate({ to: "/canvas", search: { id: note.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Couldn't save that."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-auto flex-col gap-1 py-3"
          disabled={busy}
          onClick={() => void start("canvas")}
        >
          <LayoutDashboard className="size-5" aria-hidden="true" />
          <span>{t("New canvas")}</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto flex-col gap-1 py-3"
          disabled={busy}
          onClick={() => void start("mindmap")}
        >
          <GitFork className="size-5 rotate-90" aria-hidden="true" />
          <span>{t("New mind map")}</span>
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {t("Cards and lines for thinking things through. Put your notes and links on them too.")}
      </p>
      {notes.isLoading ? (
        <LoadingState rows={3} />
      ) : notes.error && !notes.data ? (
        <ErrorState error={notes.error} onRetry={() => notes.refetch()} />
      ) : canvases.length ? (
        <ul className="space-y-2" aria-label={t("Your canvases")}>
          {canvases.map((note) => {
            const doc = parseCanvas(note.body);
            return (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/canvas", search: { id: note.id } })}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:bg-muted/50"
                >
                  <LayoutDashboard
                    className="size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {note.title || t("Untitled canvas")}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {doc.cards.length === 1 ? t("1 card") : `${doc.cards.length} ${t("cards")}`} ·{" "}
                      {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("No canvases yet.")}</p>
      )}
    </div>
  );
}

/**
 * From a daily note: opens that day's canvas, making it the first time with
 * the day's note already on it.
 */
export function DayCanvasButton({ date, notes }: { date: string; notes: Note[] }) {
  const t = useT();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const existing = dayCanvasOn(notes, date);

  async function open() {
    if (existing) {
      void navigate({ to: "/canvas", search: { id: existing.id } });
      return;
    }
    if (busy) return;
    setBusy(true);
    let id: string | null = null;
    try {
      id = await dayCanvasId(date);
      const daily = dailyNoteOn(notes, date);
      const note = await createCanvas(
        `${t("Canvas")} · ${dailyTitle(date)}`,
        dayCanvasStart(daily?.id ?? null, date),
        [`${CANVAS_DAY_PREFIX}${date}`],
        id,
      );
      putNote(queryClient, note);
      void navigate({ to: "/canvas", search: { id: note.id } });
    } catch (error) {
      // Another device may have made this day's canvas a moment ago.
      const fresh = await queryClient.fetchQuery(notesQuery()).catch(() => null);
      const found = fresh ? dayCanvasOn(fresh, date) : null;
      if (found) void navigate({ to: "/canvas", search: { id: found.id } });
      else toast.error(error instanceof Error ? error.message : t("Couldn't save that."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void open()}>
      <LayoutDashboard className="size-4" aria-hidden="true" />
      {existing ? t("Open day canvas") : t("Open as canvas")}
    </Button>
  );
}
