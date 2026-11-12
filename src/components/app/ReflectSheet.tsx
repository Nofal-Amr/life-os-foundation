import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { noteKeys, notesQuery } from "@/data/notes";
import {
  addReflection,
  linesOf,
  REFLECTION_KINDS,
  reflectionNotesOn,
  type ReflectionKind,
} from "@/data/reflections";
import { reviewByDateQuery, reviewKeys } from "@/data/reviews";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

/**
 * Reflect: one thing at a time (a good thing, a hard thing, something you're
 * grateful for, an idea, a note). Each is saved on its own; the day's review
 * gathers them, and the list below shows the day so far.
 */
export function ReflectSheet({
  open,
  onOpenChange,
  date,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
}) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ReflectionKind>("good");
  const [text, setText] = useState("");
  const review = useQuery({ ...reviewByDateQuery(date), enabled: open });
  const notes = useQuery({ ...notesQuery(), enabled: open });

  const add = useMutation({
    mutationFn: () => addReflection(date, kind, text),
    onSuccess: () => {
      setText("");
      void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
      void queryClient.invalidateQueries({ queryKey: noteKeys.all });
      // The entry appearing in the list below is the confirmation; a light tap on phones.
      try {
        navigator.vibrate?.(10);
      } catch {
        // No vibration here.
      }
    },
    onError: (error) => toast.error(toError(error).message),
  });

  const current = REFLECTION_KINDS.find((item) => item.kind === kind)!;
  const day = [
    ...linesOf(review.data?.wins).map((line) => ({ label: "Good", line })),
    ...linesOf(review.data?.challenges).map((line) => ({ label: "Hard", line })),
    ...linesOf(review.data?.gratitude).map((line) => ({ label: "Grateful", line })),
    ...reflectionNotesOn(notes.data ?? [], date).map((note) => ({
      label: note.tags.includes("idea") ? "Idea" : "Note",
      line: note.body ?? note.title,
    })),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto rounded-t-3xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6"
      >
        <SheetTitle className="text-base">Reflect</SheetTitle>
        <SheetDescription className="mt-1">
          One thing at a time. Your daily review gathers them.
        </SheetDescription>

        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) add.mutate();
          }}
        >
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What is it?">
            {REFLECTION_KINDS.map((item) => (
              <button
                key={item.kind}
                type="button"
                role="radio"
                aria-checked={kind === item.kind}
                onClick={() => setKind(item.kind)}
                className={cn(
                  "min-h-10 rounded-full border px-3.5 text-sm transition-[background-color,color,scale] duration-150 ease-out active:scale-95",
                  kind === item.kind
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:bg-accent",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Textarea
            aria-label={current.label}
            rows={3}
            className="min-h-24 text-base"
            value={text}
            placeholder={current.placeholder}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && text.trim())
                add.mutate();
            }}
          />
          <Button type="submit" className="h-12 w-full" disabled={!text.trim() || add.isPending}>
            {add.isPending ? "Adding…" : "Add"}
          </Button>
        </form>

        {day.length ? (
          <section className="mt-6" aria-label="Today so far">
            <h3 className="mb-2 text-sm font-medium text-foreground">Today so far</h3>
            <ul className="space-y-1.5">
              {day.map((item, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <span className="w-16 shrink-0 text-xs leading-5 text-muted-foreground">
                    {item.label}
                  </span>
                  <span className="min-w-0 break-words text-foreground">{item.line}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/review"
              onClick={() => onOpenChange(false)}
              className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Open the daily review
            </Link>
          </section>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
