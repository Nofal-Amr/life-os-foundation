import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/PageHeader";
import { DatePicker } from "@/components/app/DatePicker";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  reviewByDateQuery,
  reviewKeys,
  reviewsQuery,
  saveReview,
  type ReviewInput,
} from "@/data/reviews";
import { todayISO } from "@/lib/date";
import { usePreferences } from "@/hooks/usePreferences";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({
    meta: [
      { title: "Daily review · Life OS" },
      { name: "description", content: "A short structured reflection, once per day." },
      { property: "og:title", content: "Daily review · Life OS" },
      { property: "og:description", content: "A short structured reflection, once per day." },
    ],
  }),
  component: ReviewPage,
});

const MOODS = [1, 2, 3, 4, 5];

function ReviewPage() {
  const queryClient = useQueryClient();
  const { fmtDate } = usePreferences();
  const [date, setDate] = useState(todayISO());
  const review = useQuery(reviewByDateQuery(date));
  const history = useQuery(reviewsQuery());

  const [form, setForm] = useState<ReviewInput>({
    review_date: date,
    wins: null,
    challenges: null,
    gratitude: null,
    mood: null,
    tomorrow_focus: null,
  });

  useEffect(() => {
    const r = review.data;
    setForm({
      review_date: date,
      wins: r?.wins ?? null,
      challenges: r?.challenges ?? null,
      gratitude: r?.gratitude ?? null,
      mood: r?.mood ?? null,
      tomorrow_focus: r?.tomorrow_focus ?? null,
    });
  }, [review.data, date]);

  const save = useMutation({
    mutationFn: () => saveReview(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all });
      queryClient.invalidateQueries({ queryKey: reviewKeys.byDate(date) });
      toast.success("Review saved.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save review."),
  });

  return (
    <>
      <PageHeader
        title="Daily review"
        description="One review per day. Saving again updates the same entry."
      />

      <div className="mb-6 max-w-xs space-y-2">
        <Label htmlFor="review-date">Date</Label>
        <DatePicker id="review-date" value={date} disableFuture onChange={(value) => setDate(value || todayISO())} />
      </div>

      {review.isLoading ? (
        <LoadingState rows={3} />
      ) : review.error ? (
        <ErrorState error={review.error} onRetry={() => review.refetch()} />
      ) : (
        <form
          className="space-y-5 rounded-xl border border-border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="wins">Wins</Label>
            <Textarea
              id="wins"
              rows={3}
              value={form.wins ?? ""}
              onChange={(e) => setForm({ ...form, wins: e.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="challenges">Challenges</Label>
            <Textarea
              id="challenges"
              rows={3}
              value={form.challenges ?? ""}
              onChange={(e) => setForm({ ...form, challenges: e.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gratitude">Gratitude</Label>
            <Textarea
              id="gratitude"
              rows={3}
              value={form.gratitude ?? ""}
              onChange={(e) => setForm({ ...form, gratitude: e.target.value || null })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Mood</Label>
              <Select
                value={form.mood ? String(form.mood) : ""}
                onValueChange={(v) => setForm({ ...form, mood: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  {MOODS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} / 5
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="focus">Tomorrow's focus</Label>
              <Input
                id="focus"
                value={form.tomorrow_focus ?? ""}
                onChange={(e) => setForm({ ...form, tomorrow_focus: e.target.value || null })}
              />
            </div>
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : review.data ? "Update review" : "Save review"}
          </Button>
        </form>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium">Recent reviews</h2>
        {history.isLoading ? (
          <LoadingState rows={2} />
        ) : history.error ? (
          <ErrorState error={history.error} onRetry={() => history.refetch()} />
        ) : (history.data ?? []).length === 0 ? (
          <EmptyState title="No reviews yet" description="A short end-of-day note on how the day went. Your saved reflections stay here." />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {(history.data ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <button
                  type="button"
                  className="text-left hover:underline"
                  onClick={() => setDate(r.review_date)}
                >
                  {fmtDate(r.review_date)}
                </button>
                <span className="text-xs text-muted-foreground">
                  {r.mood ? `Mood ${r.mood}/5` : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
