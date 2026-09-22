import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  ListChecks,
  Palette,
  Pin,
  PinOff,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { toast } from "sonner";

import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  NOTE_COLORS,
  checklistOf,
  createNote,
  deleteNote,
  isEmptyNote,
  noteBackground,
  noteKeys,
  notesQuery,
  searchNotes,
  updateNote,
  type ChecklistItem,
  type Note,
  type NoteInput,
} from "@/data/notes";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({
    meta: [
      { title: "Notes · Life OS" },
      { name: "description", content: "Quick notes and checklists that save as you type." },
    ],
  }),
  component: NotesPage,
});

type View = "notes" | "archive";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function NotesPage() {
  const notes = useQuery(notesQuery());
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("notes");
  const [term, setTerm] = useState("");
  const [label, setLabel] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ note: Note; isNew: boolean } | null>(null);

  const all = notes.data ?? [];
  const labels = useMemo(
    () => [...new Set(all.flatMap((note) => note.tags))].sort((a, b) => a.localeCompare(b)),
    [all],
  );
  const visible = searchNotes(all, term).filter(
    (note) =>
      (view === "archive" ? note.archived : !note.archived) &&
      (!label || note.tags.includes(label)),
  );
  const pinned = visible.filter((note) => note.pinned && !note.archived);
  const others = visible.filter((note) => !note.pinned || note.archived);

  /** Instant local update of one note in the list. */
  const putLocal = useCallback(
    (note: Note) =>
      queryClient.setQueryData<Note[]>(noteKeys.all, (rows = []) => {
        const rest = rows.filter((row) => row.id !== note.id);
        return [note, ...rest];
      }),
    [queryClient],
  );

  const patch = useCallback(
    (note: Note, change: Partial<NoteInput>) => {
      const next = { ...note, ...change, updated_at: new Date().toISOString() } as Note;
      putLocal(next);
      updateNote(note.id, change).catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Couldn't save that."),
      );
    },
    [putLocal],
  );

  const remove = useCallback(
    (note: Note) => {
      const previous = queryClient.getQueryData<Note[]>(noteKeys.all);
      queryClient.setQueryData<Note[]>(noteKeys.all, (rows = []) =>
        rows.filter((row) => row.id !== note.id),
      );
      let undone = false;
      toast("Note deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            undone = true;
            if (previous) queryClient.setQueryData(noteKeys.all, previous);
          },
        },
        duration: 5000,
        onAutoClose: () => {
          if (!undone) void deleteNote(note.id).catch(() => toast.error("Couldn't delete it."));
        },
        onDismiss: () => {
          if (!undone) void deleteNote(note.id).catch(() => toast.error("Couldn't delete it."));
        },
      });
    },
    [queryClient],
  );

  // Quick add → Note lands here with ?new, straight into a blank note.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("new")) {
      startNote(false);
      window.history.replaceState(null, "", "/notes");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startNote(checklist = false) {
    const now = new Date().toISOString();
    setEditing({
      isNew: true,
      note: {
        id: newId(),
        title: "",
        body: checklist ? null : "",
        tags: label ? [label] : [],
        pinned: false,
        archived: false,
        color: null,
        checklist: checklist ? ([{ id: newId(), text: "", done: false }] as never) : null,
        created_at: now,
        updated_at: now,
        user_id: "",
      },
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      {/* Search, like Keep's top bar */}
      <div className="flex items-center gap-2">
        <label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full border border-border bg-card px-4 shadow-sm focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search your notes"
            aria-label="Search your notes"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {term ? (
            <button type="button" aria-label="Clear search" onClick={() => setTerm("")}>
              <X className="size-4 text-muted-foreground" />
            </button>
          ) : null}
        </label>
      </div>

      {/* Notes / Archive and labels */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        <Chip
          active={view === "notes" && !label}
          onClick={() => {
            setView("notes");
            setLabel(null);
          }}
        >
          Notes
        </Chip>
        {labels.map((name) => (
          <Chip
            key={name}
            active={label === name}
            onClick={() => {
              setView("notes");
              setLabel(label === name ? null : name);
            }}
          >
            <Tag className="size-3" aria-hidden="true" />
            {name}
          </Chip>
        ))}
        <Chip
          active={view === "archive"}
          onClick={() => {
            setView("archive");
            setLabel(null);
          }}
        >
          <Archive className="size-3" aria-hidden="true" />
          Archive
        </Chip>
      </div>

      {/* Take a note */}
      {view === "notes" ? (
        <div className="mx-auto flex max-w-xl items-center gap-1 rounded-xl border border-border bg-card pl-4 pr-1 shadow-sm">
          <button
            type="button"
            onClick={() => startNote(false)}
            className="h-12 min-w-0 flex-1 text-left text-sm text-muted-foreground"
          >
            Take a note…
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="New checklist"
            onClick={() => startNote(true)}
          >
            <ListChecks className="size-5" />
          </Button>
        </div>
      ) : null}

      {notes.isLoading ? (
        <LoadingState rows={4} />
      ) : notes.error ? (
        <ErrorState error={notes.error} onRetry={() => notes.refetch()} />
      ) : !visible.length ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {term
            ? "No notes match that."
            : view === "archive"
              ? "Archived notes show up here."
              : "Notes you add appear here."}
        </p>
      ) : (
        <div className="space-y-6">
          {pinned.length ? (
            <NoteGrid
              title="Pinned"
              notes={pinned}
              onOpen={(note) => setEditing({ note, isNew: false })}
              onPatch={patch}
            />
          ) : null}
          <NoteGrid
            title={pinned.length ? "Others" : null}
            notes={others}
            onOpen={(note) => setEditing({ note, isNew: false })}
            onPatch={patch}
          />
        </div>
      )}

      {/* Floating new-note button on phones */}
      {view === "notes" ? (
        <button
          type="button"
          onClick={() => startNote(false)}
          aria-label="New note"
          className="fixed bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+6.75rem)] right-5 z-30 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 md:hidden"
        >
          <Plus className="size-6" />
        </button>
      ) : null}

      {editing ? (
        <NoteEditor
          key={editing.note.id}
          initial={editing.note}
          isNew={editing.isNew}
          onLocal={putLocal}
          onDelete={(note) => {
            setEditing(null);
            remove(note);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-accent text-accent-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function NoteGrid({
  title,
  notes,
  onOpen,
  onPatch,
}: {
  title: string | null;
  notes: Note[];
  onOpen: (note: Note) => void;
  onPatch: (note: Note, change: Partial<NoteInput>) => void;
}) {
  if (!notes.length) return null;
  return (
    <section>
      {title ? (
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
          {title}
        </p>
      ) : null}
      {/* Masonry: CSS columns keep each card its natural height. */}
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} onOpen={() => onOpen(note)} onPatch={onPatch} />
        ))}
      </div>
    </section>
  );
}

function NoteCard({
  note,
  onOpen,
  onPatch,
}: {
  note: Note;
  onOpen: () => void;
  onPatch: (note: Note, change: Partial<NoteInput>) => void;
}) {
  const items = checklistOf(note);
  const open = items?.filter((item) => !item.done) ?? [];
  const done = items?.filter((item) => item.done) ?? [];
  return (
    <article
      className="group relative mb-3 break-inside-avoid rounded-xl border border-border bg-card transition-shadow hover:shadow-md motion-safe:animate-in motion-safe:fade-in"
      style={{ background: noteBackground(note.color) }}
    >
      <button type="button" onClick={onOpen} className="block w-full p-4 pr-9 text-left">
        {note.title ? (
          <p className="mb-1.5 text-[15px] font-semibold leading-snug">{note.title}</p>
        ) : null}
        {items ? (
          <ul className="space-y-1 text-sm">
            {open.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <span className="mt-1 size-3.5 shrink-0 rounded-[4px] border border-muted-foreground/60" />
                <span className="min-w-0 break-words">{item.text}</span>
              </li>
            ))}
            {done.length ? (
              <li className="pt-1 text-xs text-muted-foreground">+ {done.length} checked</li>
            ) : null}
          </ul>
        ) : note.body ? (
          <p className="line-clamp-[12] whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85">
            {note.body}
          </p>
        ) : !note.title ? (
          <p className="text-sm text-muted-foreground">Empty note</p>
        ) : null}
        {note.tags.length ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {note.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-foreground/[0.07] px-2 py-0.5 text-xs">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </button>
      <button
        type="button"
        aria-label={note.pinned ? "Unpin" : "Pin"}
        onClick={() => onPatch(note, { pinned: !note.pinned })}
        className={cn(
          "absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground transition-opacity hover:bg-foreground/[0.07] hover:text-foreground",
          note.pinned ? "opacity-100" : "opacity-60 md:opacity-0 md:group-hover:opacity-100",
        )}
      >
        {note.pinned ? <Pin className="size-4 fill-current" /> : <Pin className="size-4" />}
      </button>
    </article>
  );
}

/* ------------------------------------------------------------------ Editor */

function NoteEditor({
  initial,
  isNew,
  onLocal,
  onDelete,
  onClose,
}: {
  initial: Note;
  isNew: boolean;
  onLocal: (note: Note) => void;
  onDelete: (note: Note) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState<Note>(initial);
  const [saved, setSaved] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const created = useRef(!isNew);
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);
  const latest = useRef(note);
  latest.current = note;

  const items = checklistOf(note);

  const persist = useCallback(async () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    const current = latest.current;
    const input: NoteInput = {
      title: current.title,
      body: current.body,
      tags: current.tags,
      pinned: current.pinned,
      archived: current.archived,
      color: current.color,
      checklist: checklistOf(current),
    };
    if (!created.current && isEmptyNote(input)) return;
    dirty.current = false;
    setSaving(true);
    try {
      if (created.current) await updateNote(current.id, input);
      else {
        await createNote({ ...input, id: current.id });
        track("note_created", { checklist: !!input.checklist });
        created.current = true;
      }
      setSaved(true);
    } catch (error) {
      dirty.current = true;
      toast.error(error instanceof Error ? error.message : "Couldn't save the note.");
    } finally {
      setSaving(false);
    }
  }, []);

  function change(patch: Partial<Note>) {
    setNote((current) => {
      const next = { ...current, ...patch, updated_at: new Date().toISOString() } as Note;
      if (
        created.current ||
        !isEmptyNote({ title: next.title, body: next.body, checklist: checklistOf(next) })
      ) {
        onLocal(next);
      }
      return next;
    });
    dirty.current = true;
    setSaved(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void persist(), 600);
  }

  // Save whatever is pending when the editor goes away.
  useEffect(() => () => void persist(), [persist]);

  const close = () => {
    void persist();
    onClose();
  };

  function setItems(next: ChecklistItem[]) {
    change({ checklist: next as unknown as Note["checklist"] });
  }

  function toggleChecklist() {
    if (items) {
      const text = items
        .map((item) => item.text)
        .filter(Boolean)
        .join("\n");
      change({ checklist: null, body: [note.body, text].filter(Boolean).join("\n") });
    } else {
      const lines = (note.body ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      change({
        body: null,
        checklist: (lines.length ? lines : [""]).map((text) => ({
          id: newId(),
          text,
          done: false,
        })) as never,
      });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-2xl sm:border [&>button:last-child]:hidden"
        style={{ background: noteBackground(note.color) ?? "var(--color-card)" }}
      >
        <DialogTitle className="sr-only">{note.title || "Note"}</DialogTitle>
        <div className="flex items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <Button type="button" variant="ghost" size="icon" aria-label="Done" onClick={close}>
            <ArrowLeft className="size-5" />
          </Button>
          <span className="ml-1 text-xs text-muted-foreground" aria-live="polite">
            {saving
              ? "Saving…"
              : saved
                ? `Edited ${formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}`
                : ""}
          </span>
          <div className="ml-auto flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={note.pinned ? "Unpin" : "Pin"}
              onClick={() => change({ pinned: !note.pinned })}
            >
              {note.pinned ? <PinOff className="size-5" /> : <Pin className="size-5" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={note.archived ? "Unarchive" : "Archive"}
              onClick={() => {
                change({ archived: !note.archived, pinned: false });
                toast(note.archived ? "Note unarchived" : "Note archived");
                window.setTimeout(close, 50);
              }}
            >
              {note.archived ? (
                <ArchiveRestore className="size-5" />
              ) : (
                <Archive className="size-5" />
              )}
            </Button>
          </div>
        </div>

        <div data-note-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
          <AutoTextarea
            value={note.title}
            onChange={(title) => change({ title })}
            placeholder="Title"
            className="text-xl font-semibold"
            autoFocus={isNew}
          />
          {items ? (
            <ChecklistEditor items={items} onChange={setItems} />
          ) : (
            <AutoTextarea
              value={note.body ?? ""}
              onChange={(body) => change({ body })}
              placeholder="Note"
              className="mt-2 min-h-40 text-[15px] leading-relaxed"
              autoFocus={!isNew && !note.title}
            />
          )}
          <LabelEditor tags={note.tags} onChange={(tags) => change({ tags })} />
        </div>

        <div className="flex items-center gap-1 border-t border-border/60 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Colour">
                <Palette className="size-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="flex flex-wrap gap-2">
                <Swatch
                  active={!note.color}
                  label="Default"
                  onClick={() => change({ color: null })}
                />
                {NOTE_COLORS.map((color) => (
                  <Swatch
                    key={color.key}
                    active={note.color === color.key}
                    label={color.label}
                    background={noteBackground(color.key)}
                    onClick={() => change({ color: color.key })}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={items ? "Show as text" : "Show checkboxes"}
            aria-pressed={!!items}
            onClick={toggleChecklist}
          >
            <ListChecks className="size-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto"
            aria-label="Delete note"
            onClick={() => {
              if (timer.current) window.clearTimeout(timer.current);
              dirty.current = false;
              if (created.current) onDelete(latest.current);
              else onClose();
            }}
          >
            <Trash2 className="size-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Swatch({
  active,
  label,
  background,
  onClick,
}: {
  active: boolean;
  label: string;
  background?: string | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-full border",
        active ? "border-foreground" : "border-border",
      )}
      style={{ background: background ?? "var(--color-card)" }}
    >
      {active ? <Check className="size-4" /> : null}
    </button>
  );
}

/** A borderless textarea that grows with its content. */
function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Resize before paint, and hold the scroll position while the box is
  // briefly collapsed to measure it; otherwise the page jumps on every key.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scroller = el.closest<HTMLElement>("[data-note-scroll]");
    const top = scroller?.scrollTop ?? 0;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
    if (scroller) scroller.scrollTop = top;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      autoFocus={autoFocus}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "block w-full resize-none overflow-hidden bg-transparent py-1 outline-none placeholder:text-muted-foreground",
        className,
      )}
    />
  );
}

function ChecklistEditor({
  items,
  onChange,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}) {
  const refs = useRef(new Map<string, HTMLInputElement>());
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (focusId) refs.current.get(focusId)?.focus();
  }, [focusId, items]);

  const open = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done);

  const update = (id: string, patch: Partial<ChecklistItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const addAfter = (id: string | null) => {
    const item = { id: newId(), text: "", done: false };
    const index = id ? items.findIndex((row) => row.id === id) + 1 : items.length;
    onChange([...items.slice(0, index), item, ...items.slice(index)]);
    setFocusId(item.id);
  };

  const row = (item: ChecklistItem) => (
    <li key={item.id} className="group flex items-center gap-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        aria-label={item.text || "Item"}
        onClick={() => update(item.id, { done: !item.done })}
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px]",
          item.done
            ? "border-muted-foreground bg-muted-foreground text-card"
            : "border-muted-foreground/70",
        )}
      >
        {item.done ? <Check className="size-3" strokeWidth={3} /> : null}
      </button>
      <input
        ref={(el) => {
          if (el) refs.current.set(item.id, el);
          else refs.current.delete(item.id);
        }}
        value={item.text}
        placeholder="List item"
        onChange={(event) => update(item.id, { text: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addAfter(item.id);
          } else if (event.key === "Backspace" && !item.text && items.length > 1) {
            event.preventDefault();
            const index = items.findIndex((r) => r.id === item.id);
            onChange(items.filter((r) => r.id !== item.id));
            setFocusId(items[Math.max(0, index - 1)]?.id ?? null);
          }
        }}
        className={cn(
          "min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-muted-foreground",
          item.done && "text-muted-foreground line-through",
        )}
      />
      <button
        type="button"
        aria-label="Remove item"
        onClick={() => onChange(items.filter((r) => r.id !== item.id))}
        className="rounded p-1 text-muted-foreground opacity-60 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100"
      >
        <X className="size-4" />
      </button>
    </li>
  );

  return (
    <div className="mt-2">
      <ul className="space-y-0.5">{open.map(row)}</ul>
      <button
        type="button"
        onClick={() => addAfter(open.at(-1)?.id ?? null)}
        className="mt-1 flex items-center gap-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-4" /> List item
      </button>
      {done.length ? (
        <div className="mt-3 border-t border-border/60 pt-2">
          <p className="mb-1 text-xs text-muted-foreground">{done.length} checked</p>
          <ul className="space-y-0.5">{done.map(row)}</ul>
        </div>
      ) : null}
    </div>
  );
}

function LabelEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (value && !tags.includes(value)) onChange([...tags, value]);
    setDraft("");
  };
  return (
    <div className="mt-5 flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.07] py-0.5 pl-2.5 pr-1 text-xs"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(tags.filter((t) => t !== tag))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Tag className="size-3" aria-hidden="true" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="Add label"
          aria-label="Add label"
          className="w-24 bg-transparent py-1 outline-none placeholder:text-muted-foreground"
        />
      </span>
    </div>
  );
}
