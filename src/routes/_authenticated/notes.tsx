import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createNote,
  deleteNote,
  noteKeys,
  notesQuery,
  parseTags,
  searchNotes,
  updateNote,
  type Note,
  type NoteInput,
} from "@/data/notes";
import { usePreferences } from "@/hooks/usePreferences";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({
    meta: [
      { title: "Notes — Life OS" },
      { name: "description", content: "Write, tag and search your personal notes." },
      { property: "og:title", content: "Notes — Life OS" },
      { property: "og:description", content: "Write, tag and search your personal notes." },
    ],
  }),
  component: NotesPage,
});

const emptyForm: NoteInput = { title: "", body: null, tags: [] };

function NotesPage() {
  const queryClient = useQueryClient();
  const notes = useQuery(notesQuery());
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [form, setForm] = useState<NoteInput>(emptyForm);
  const [tagsText, setTagsText] = useState("");
  const [toDelete, setToDelete] = useState<Note | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: noteKeys.all });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, tags: parseTags(tagsText) };
      return editing ? updateNote(editing.id, payload) : createNote(payload);
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success(editing ? "Note updated." : "Note created.");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      invalidate();
      setToDelete(null);
      toast.success("Note deleted.");
    },
    onError,
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setTagsText("");
    setDialogOpen(true);
  }

  function openEdit(note: Note) {
    setEditing(note);
    setForm({ title: note.title, body: note.body, tags: note.tags });
    setTagsText(note.tags.join(", "));
    setDialogOpen(true);
  }

  const visible = searchNotes(notes.data ?? [], search);

  return (
    <>
      <PageHeader
        title="Notes"
        description="A quiet place for thinking out loud."
        actions={<Button onClick={openCreate}>New note</Button>}
      />

      <div className="mb-6 max-w-sm">
        <Label htmlFor="note-search" className="sr-only">
          Search notes
        </Label>
        <Input
          id="note-search"
          placeholder="Search title, body or tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {notes.isLoading ? (
        <LoadingState />
      ) : notes.error ? (
        <ErrorState error={notes.error} onRetry={() => notes.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={search ? "No matching notes" : "No notes yet"}
          description={search ? "Try a different search term." : "Capture your first thought."}
          action={search ? undefined : <Button onClick={openCreate}>New note</Button>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((note) => (
            <li key={note.id} className="flex flex-col rounded-xl border border-border bg-card p-4">
              <p className="font-medium">{note.title}</p>
              {note.body ? (
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                  {note.body}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {note.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {fmtDateTime(note.updated_at)}
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(note)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setToDelete(note)}>
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit note" : "New note"}
        pending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="note-title">Title</Label>
          <Input
            id="note-title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note-body">Body</Label>
          <Textarea
            id="note-body"
            rows={8}
            value={form.body ?? ""}
            onChange={(e) => setForm({ ...form, body: e.target.value || null })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note-tags">Tags (comma separated)</Label>
          <Input
            id="note-tags"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
          />
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this note?"
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}
