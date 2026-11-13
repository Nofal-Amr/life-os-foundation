import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Lightbulb, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import {
  dailyNoteOn,
  dailyTitle,
  isDailyNote,
  saveDailyNote,
  searchDailyNotes,
  shiftDay,
} from "@/data/dailyNotes";
import { noteKeys, notesQuery, type Note } from "@/data/notes";
import { REFLECTION_TAG, reflectionNotesOn } from "@/data/reflections";
import { todayISO } from "@/lib/date";
import { LIVE_POLL_MS, useLiveNotes } from "@/lib/liveNotes";
import { cn } from "@/lib/utils";

/** How long after the last key press the day's note is saved. */
const SAVE_DELAY_MS = 800;

/**
 * The day's note: titled with the date, one page you just type into. It saves
 * as you type and picks up edits made on your other devices within seconds.
 */
export function DailyNote({ date, onDate }: { date: string; onDate: (date: string) => void }) {
  const notes = useQuery({
    ...notesQuery(),
    refetchInterval: LIVE_POLL_MS,
    refetchIntervalInBackground: false,
  });
  useLiveNotes();
  const all = useMemo(() => notes.data ?? [], [notes.data]);
  const note = dailyNoteOn(all, date);
  const reflections = reflectionNotesOn(all, date);
  const [term, setTerm] = useState("");
  const results = useMemo(() => searchDailyNotes(all, term), [all, term]);
  const today = todayISO();
  const recent = useMemo(
    () =>
      all
        .filter((n) => isDailyNote(n) && (n.body ?? "").trim())
        .map((n) => n.tags.find((t) => t.startsWith("daily:"))!.slice(6))
        .filter((d) => d !== date)
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 5),
    [all, date],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <label className="flex h-11 items-center gap-3 rounded-full border border-border bg-card px-4 shadow-sm focus-within:ring-2 focus-within:ring-ring">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search your days"
          aria-label="Search your daily notes"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {term ? (
          <button type="button" aria-label="Clear search" onClick={() => setTerm("")}>
            <X className="size-4 text-muted-foreground" />
          </button>
        ) : null}
      </label>

      {term.trim() ? (
        <section aria-label="Search results" className="space-y-2">
          {results.length ? (
            results.map((result) => (
              <button
                key={result.note.id}
                type="button"
                onClick={() => {
                  setTerm("");
                  onDate(result.date);
                }}
                className="block w-full rounded-xl border border-border bg-card p-3 text-left hover:bg-muted/50"
              >
                <span className="block text-sm font-medium">{dailyTitle(result.date)}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{result.snippet}</span>
              </button>
            ))
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No day mentions that.</p>
          )}
        </section>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Previous day"
              onClick={() => onDate(shiftDay(date, -1))}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-xs font-medium text-muted-foreground">
                {date === today ? "Today" : date < today ? "Earlier day" : "Coming day"}
              </p>
              <h2 className="truncate text-lg font-semibold" data-testid="daily-title">
                {dailyTitle(date)}
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Next day"
              onClick={() => onDate(shiftDay(date, 1))}
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm">
            {date !== today ? (
              <Button type="button" variant="outline" size="sm" onClick={() => onDate(today)}>
                Back to today
              </Button>
            ) : null}
            <label className="inline-flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden="true" />
              <span className="sr-only">Go to a day</span>
              <input
                type="date"
                value={date}
                onChange={(event) => event.target.value && onDate(event.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
            </label>
          </div>

          {notes.isLoading ? (
            <LoadingState rows={3} />
          ) : notes.error && !notes.data ? (
            <ErrorState error={notes.error} onRetry={() => notes.refetch()} />
          ) : (
            <DailyEditor key={date} date={date} note={note} />
          )}

          {reflections.length ? (
            <section className="space-y-2 rounded-xl border border-border bg-card p-4">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Lightbulb className="size-4 text-muted-foreground" aria-hidden="true" />
                From Reflect
              </h3>
              <ul className="space-y-1.5 text-sm">
                {reflections.map((item) => (
                  <li key={item.id} className="flex gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.tags.includes(REFLECTION_TAG.idea) ? "Idea" : "Note"}
                    </span>
                    <span className="min-w-0 whitespace-pre-wrap">{item.body}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {recent.length ? (
            <section aria-label="Other days" className="space-y-1">
              <h3 className="text-xs font-medium text-muted-foreground">Other days</h3>
              <div className="flex flex-wrap gap-2">
                {recent.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onDate(day)}
                    className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted/50"
                  >
                    {dailyTitle(day)}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

function DailyEditor({ date, note }: { date: string; note: Note | null }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(note?.body ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const [fromElsewhere, setFromElsewhere] = useState(false);
  const textRef = useRef(text);
  const dirty = useRef(false);
  const noteRef = useRef(note);
  /** Newest version of this note this device has seen or written (ms). */
  const knownAt = useRef(note ? Date.parse(note.updated_at) : 0);
  const timer = useRef<number | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());

  // A newer copy from the server: another device wrote it. Last write wins:
  // while you have unsaved typing here, yours is about to be the last write.
  useEffect(() => {
    if (!note) return;
    noteRef.current = note;
    const at = Date.parse(note.updated_at);
    if (!(at > knownAt.current)) return;
    knownAt.current = at;
    if (dirty.current) return;
    const body = note.body ?? "";
    if (body === textRef.current) return;
    textRef.current = body;
    setText(body);
    setFromElsewhere(true);
  }, [note]);

  useEffect(() => {
    if (!fromElsewhere) return;
    const id = window.setTimeout(() => setFromElsewhere(false), 5000);
    return () => window.clearTimeout(id);
  }, [fromElsewhere, text]);

  const flush = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    chain.current = chain.current.then(async () => {
      if (!dirty.current) return;
      const body = textRef.current;
      // Don't make an empty note just for opening a day.
      if (!noteRef.current && !body.trim()) {
        dirty.current = false;
        return;
      }
      setState("saving");
      try {
        const saved = await saveDailyNote(date, body, noteRef.current);
        noteRef.current = saved;
        knownAt.current = Math.max(knownAt.current, Date.parse(saved.updated_at));
        if (textRef.current === body) dirty.current = false;
        queryClient.setQueryData<Note[]>(noteKeys.all, (rows = []) => [
          saved,
          ...rows.filter((row) => row.id !== saved.id),
        ]);
        setState("saved");
      } catch {
        setState("error");
      }
    });
    return chain.current;
  }, [date, queryClient]);

  // Save on leaving the day, hiding the tab or closing the page.
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

  return (
    <div className="space-y-1.5">
      <textarea
        value={text}
        onChange={(event) => {
          const value = event.target.value;
          textRef.current = value;
          dirty.current = true;
          setText(value);
          setFromElsewhere(false);
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
        }}
        onBlur={() => void flush()}
        aria-label={`Note for ${dailyTitle(date)}`}
        placeholder="Write anything. It saves as you type."
        data-testid="daily-body"
        className="block min-h-[45vh] w-full resize-none rounded-xl border border-border bg-card p-4 text-base leading-relaxed shadow-sm outline-none [field-sizing:content] placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p
        className={cn("min-h-5 text-xs text-muted-foreground")}
        role="status"
        data-testid="daily-status"
      >
        {fromElsewhere
          ? "Updated on another device"
          : state === "saving"
            ? "Saving…"
            : state === "saved"
              ? "Saved"
              : state === "error"
                ? "Not saved yet. It will try again as you type."
                : ""}
      </p>
    </div>
  );
}
