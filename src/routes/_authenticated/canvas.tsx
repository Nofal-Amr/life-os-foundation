import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CanvasBoard } from "@/components/app/canvas/CanvasBoard";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { canvasDayOf, isCanvasNote, parseCanvas, saveCanvas, type CanvasDoc } from "@/data/canvas";
import { dailyDateOf } from "@/data/dailyNotes";
import { deleteNote, noteKeys, notesQuery, type Note } from "@/data/notes";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/canvas")({
  head: () => ({
    meta: [
      { title: "Canvas · Life OS" },
      { name: "description", content: "Think in cards and lines: mind maps and flows." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { id?: string } =>
    typeof search["id"] === "string" ? { id: search["id"] } : {},
  component: CanvasPage,
});

/** How long after the last change a canvas is saved. */
const SAVE_DELAY_MS = 700;

function CanvasPage() {
  const t = useT();
  const { id } = Route.useSearch();
  const notes = useQuery(notesQuery());
  const note = useMemo(
    () => (id ? notes.data?.find((n) => n.id === id && isCanvasNote(n)) : undefined),
    [id, notes.data],
  );

  if (notes.isLoading) return <LoadingState rows={3} />;
  if (notes.error && !notes.data)
    return <ErrorState error={notes.error} onRetry={() => notes.refetch()} />;
  if (!note) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">{t("This canvas isn't here any more.")}</p>
        <Button asChild variant="outline">
          <Link to="/notes" search={{ view: "canvas" }}>
            {t("Back to canvases")}
          </Link>
        </Button>
      </div>
    );
  }
  // Keyed by id so moving between canvases starts fresh.
  return <CanvasEditor key={note.id} note={note} notes={notes.data ?? []} />;
}

function CanvasEditor({ note, notes }: { note: Note; notes: Note[] }) {
  const t = useT();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<CanvasDoc>(() => parseCanvas(note.body));
  const [title, setTitle] = useState(note.title);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const latest = useRef({ doc, title });
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);
  const day = canvasDayOf(note);

  const flush = useCallback(async () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    dirty.current = false;
    const { doc: d, title: tt } = latest.current;
    setState("saving");
    try {
      const saved = await saveCanvas(note.id, tt.trim() || "Untitled canvas", d);
      queryClient.setQueryData<Note[]>(noteKeys.all, (rows = []) =>
        rows.map((row) => (row.id === saved.id ? saved : row)),
      );
      setState(dirty.current ? "saving" : "saved");
    } catch {
      dirty.current = true;
      setState("error");
    }
  }, [note.id, queryClient]);

  const schedule = useCallback(
    (delay = SAVE_DELAY_MS) => {
      dirty.current = true;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), delay);
    },
    [flush],
  );

  const onChange = useCallback(
    (next: CanvasDoc, opts?: { viewOnly?: boolean }) => {
      latest.current = { ...latest.current, doc: next };
      if (opts?.viewOnly) {
        // Where you were looking is kept too, but it needn't save on every
        // frame, and it never holds back a save that is already waiting.
        if (!timer.current) schedule(2000);
        return;
      }
      setDoc(next);
      schedule();
    },
    [schedule],
  );

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onUnload = () => void flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onUnload);
      void flush();
    };
  }, [flush]);

  const openNote = useCallback(
    (target: Note) => {
      void flush();
      const date = dailyDateOf(target);
      void navigate(
        date
          ? { to: "/notes", search: { day: date } }
          : { to: "/notes", search: { open: target.id } },
      );
    },
    [flush, navigate],
  );

  async function remove() {
    if (timer.current) window.clearTimeout(timer.current);
    dirty.current = false;
    try {
      await deleteNote(note.id);
      queryClient.setQueryData<Note[]>(noteKeys.all, (rows = []) =>
        rows.filter((row) => row.id !== note.id),
      );
      void navigate({ to: "/notes", search: { view: "canvas" } });
    } catch {
      toast.error(t("Couldn't delete it."));
    }
  }

  return (
    <div className="-mx-2 flex h-[calc(100dvh-12.5rem)] min-h-[380px] flex-col gap-2 md:mx-0 md:h-[calc(100dvh-6rem)]">
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" aria-label={t("Back")}>
          <Link
            to="/notes"
            search={day ? { day } : { view: "canvas" }}
            onClick={() => void flush()}
          >
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Link>
        </Button>
        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            latest.current = { ...latest.current, title: event.target.value };
            schedule();
          }}
          aria-label={t("Canvas name")}
          placeholder={t("Untitled canvas")}
          className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span
          className="hidden text-xs text-muted-foreground sm:inline"
          role="status"
          data-testid="canvas-status"
        >
          {state === "saving"
            ? t("Saving…")
            : state === "saved"
              ? t("Saved")
              : state === "error"
                ? t("Not saved yet")
                : ""}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("Delete canvas")}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <CanvasBoard doc={doc} onChange={onChange} notes={notes} onOpenNote={openNote} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("Delete this canvas?")}
        description={t("Its cards and lines go. Notes placed on it stay in Notes.")}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
