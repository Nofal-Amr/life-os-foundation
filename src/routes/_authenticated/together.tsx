import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import {
  CalendarDays,
  Copy,
  ListChecks,
  LogOut,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DatePicker } from "@/components/app/DatePicker";
import { PageHeader } from "@/components/app/PageHeader";
import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addPodEvent,
  addPodItem,
  addPodList,
  clearDoneItems,
  createPod,
  deletePodEvent,
  deletePodItem,
  deletePodList,
  isValidCode,
  joinPod,
  normaliseCode,
  podEventsQuery,
  podListItemsQuery,
  podListsQuery,
  podMembersQuery,
  podsQuery,
  removeMember,
  renewPodCode,
  setPodItemDone,
  togetherKeys,
  type Pod,
  type PodList,
} from "@/data/together";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/together")({
  head: () => ({
    meta: [
      { title: "Together · Life OS" },
      {
        name: "description",
        content: "A shared calendar and shared lists with family or friends, joined with a code.",
      },
    ],
  }),
  component: TogetherPage,
});

const LIVE = 15_000;
const SPACE_KEY = "together:space";

function TogetherPage() {
  const queryClient = useQueryClient();
  const pods = useQuery({ ...podsQuery(), refetchInterval: LIVE });
  const members = useQuery({ ...podMembersQuery(), refetchInterval: LIVE });
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!pods.data?.length) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(SPACE_KEY);
    } catch {
      // Ignore.
    }
    setActive((current) =>
      current && pods.data.some((pod) => pod.id === current)
        ? current
        : (pods.data.find((pod) => pod.id === saved)?.id ?? pods.data[0]!.id),
    );
  }, [pods.data]);

  const choose = (id: string) => {
    setActive(id);
    try {
      localStorage.setItem(SPACE_KEY, id);
    } catch {
      // Ignore.
    }
  };

  const refresh = () => {
    for (const key of Object.values(togetherKeys))
      void queryClient.invalidateQueries({ queryKey: key });
  };

  if (pods.isLoading || members.isLoading) {
    return (
      <>
        <PageHeader title="Together" description="Shared with family or friends." />
        <LoadingState rows={3} />
      </>
    );
  }
  if (pods.error || members.error) {
    return (
      <>
        <PageHeader title="Together" description="Shared with family or friends." />
        <ErrorState error={pods.error ?? members.error} onRetry={refresh} />
      </>
    );
  }

  const pod = (pods.data ?? []).find((item) => item.id === active) ?? null;

  return (
    <>
      <PageHeader
        title="Together"
        description="A shared calendar and lists with family or friends. Only what you put here is shared."
      />
      {(pods.data ?? []).length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {(pods.data ?? []).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => choose(item.id)}
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm",
                item.id === active
                  ? "border-primary bg-primary/15"
                  : "border-border text-muted-foreground",
              )}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
      {pod ? <Space pod={pod} onChanged={refresh} /> : null}
      <StartOrJoin first={!pod} onDone={(id) => (refresh(), choose(id))} />
    </>
  );
}

/** Create a space, or join one with its code. */
function StartOrJoin({ first, onDone }: { first: boolean; onDone: (id: string) => void }) {
  const { displayName } = usePreferencesName();
  const [mode, setMode] = useState<"start" | "join" | null>(first ? "start" : null);
  const [name, setName] = useState("Home");
  const [me, setMe] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => setMe(displayName), [displayName]);

  const start = useMutation({
    mutationFn: () => createPod(name.trim() || "Home", me.trim() || "Me"),
    onSuccess: (id) => {
      toast.success("Space created. Share its code to invite people.");
      onDone(id);
      setMode(null);
    },
    onError: (error) => toast.error(toError(error).message),
  });
  const join = useMutation({
    mutationFn: () => joinPod(code, me.trim() || "Me"),
    onSuccess: (id) => {
      toast.success("You're in.");
      onDone(id);
      setMode(null);
      setCode("");
    },
    onError: (error) => toast.error(toError(error).message),
  });

  return (
    <section className={cn("space-y-4", !first && "mt-8 border-t border-border pt-6")}>
      <div className="flex flex-wrap gap-2">
        <Button variant={mode === "start" ? "default" : "outline"} onClick={() => setMode("start")}>
          <Plus className="size-4" /> Start a space
        </Button>
        <Button variant={mode === "join" ? "default" : "outline"} onClick={() => setMode("join")}>
          <Users className="size-4" /> Join with a code
        </Button>
      </div>

      {mode ? (
        <form
          className="stat-card max-w-md space-y-3 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (mode === "start") start.mutate();
            else if (isValidCode(code)) join.mutate();
          }}
        >
          {mode === "start" ? (
            <div className="space-y-2">
              <Label htmlFor="pod-name">Name of the space</Label>
              <Input
                id="pod-name"
                className="h-11"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="pod-code">Invite code</Label>
              <Input
                id="pod-code"
                className="h-12 font-mono text-xl tracking-[0.3em] uppercase"
                autoCapitalize="characters"
                autoComplete="off"
                inputMode="text"
                maxLength={6}
                placeholder="ABC234"
                value={code}
                onChange={(e) => setCode(normaliseCode(e.target.value))}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="pod-me">Your name there</Label>
            <Input
              id="pod-me"
              className="h-11"
              maxLength={40}
              value={me}
              onChange={(e) => setMe(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="h-11 w-full"
            disabled={start.isPending || join.isPending || (mode === "join" && !isValidCode(code))}
          >
            {mode === "start" ? "Create" : "Join"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Members see the space's calendar and lists, and each other's names. Nothing else from
            your Life OS.
          </p>
        </form>
      ) : null}
    </section>
  );
}

function usePreferencesName() {
  const { user } = useAuth();
  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
  return { displayName: meta.full_name ?? meta.name ?? user?.email?.split("@")[0] ?? "" };
}

function Space({ pod, onChanged }: { pod: Pod; onChanged: () => void }) {
  const { user } = useAuth();
  const members = useQuery(podMembersQuery());
  const [tab, setTab] = useState<"calendar" | "lists">("lists");
  const [leaving, setLeaving] = useState(false);
  const people = (members.data ?? []).filter((member) => member.pod_id === pod.id);
  const mine = people.find((member) => member.user_id === user?.id);
  const owner = mine?.role === "owner";

  const renew = useMutation({
    mutationFn: () => renewPodCode(pod.id),
    onSuccess: () => {
      toast.success("New code. The old one no longer works.");
      onChanged();
    },
    onError: (error) => toast.error(toError(error).message),
  });
  const leave = useMutation({
    mutationFn: () => removeMember(pod.id, user!.id),
    onSuccess: () => {
      toast.success(`You left ${pod.name}.`);
      onChanged();
    },
    onError: (error) => toast.error(toError(error).message),
  });

  async function share() {
    const text = `Join "${pod.name}" on Life OS with the code ${pod.invite_code} (More → Together → Join with a code).`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Invite copied.");
      }
    } catch {
      // Cancelled.
    }
  }

  return (
    <div className="space-y-5">
      <section className="stat-card space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">{pod.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {people
                .map(
                  (member) => member.display_name + (member.user_id === user?.id ? " (you)" : ""),
                )
                .join(", ")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Invite code</p>
            <p className="font-mono text-2xl font-semibold tracking-[0.25em]">{pod.invite_code}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void share()}>
            <Share2 className="size-4" /> Invite
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void navigator.clipboard
                .writeText(pod.invite_code)
                .then(() => toast.success("Code copied."))
            }
          >
            <Copy className="size-4" /> Copy code
          </Button>
          {owner ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => renew.mutate()}
              disabled={renew.isPending}
            >
              <RefreshCw className="size-4" /> New code
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setLeaving(true)}>
            <LogOut className="size-4" /> Leave
          </Button>
        </div>
      </section>

      <div className="flex gap-1 rounded-lg bg-secondary p-1" role="tablist" aria-label={pod.name}>
        {(
          [
            { value: "lists", label: "Lists", icon: ListChecks },
            { value: "calendar", label: "Calendar", icon: CalendarDays },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={tab === option.value}
            onClick={() => setTab(option.value)}
            className={cn(
              "flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium",
              tab === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <option.icon className="size-4" /> {option.label}
          </button>
        ))}
      </div>

      {tab === "lists" ? <Lists pod={pod} /> : <SharedCalendar pod={pod} />}

      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={`Leave ${pod.name}?`}
        description={
          people.length === 1
            ? "You're the only one here, so the space and everything in it will be deleted."
            : "You'll stop seeing its calendar and lists. You can join again with the code."
        }
        onConfirm={() => leave.mutate()}
      />
    </div>
  );
}

function Lists({ pod }: { pod: Pod }) {
  const queryClient = useQueryClient();
  const lists = useQuery({ ...podListsQuery(), refetchInterval: LIVE });
  const items = useQuery({ ...podListItemsQuery(), refetchInterval: LIVE });
  const [newList, setNewList] = useState("");
  const mine = (lists.data ?? []).filter((list) => list.pod_id === pod.id);
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: togetherKeys.lists });
    void queryClient.invalidateQueries({ queryKey: togetherKeys.items });
  };
  const add = useMutation({
    mutationFn: (title: string) => addPodList(pod.id, title),
    onSuccess: () => {
      setNewList("");
      invalidate();
    },
    onError: (error) => toast.error(toError(error).message),
  });

  if (lists.isLoading || items.isLoading) return <LoadingState rows={2} />;

  return (
    <div className="space-y-4">
      {mine.map((list) => (
        <ListCard
          key={list.id}
          list={list}
          items={(items.data ?? []).filter((item) => item.list_id === list.id)}
          onChanged={invalidate}
        />
      ))}
      {!mine.length ? (
        <div className="flex flex-wrap gap-2">
          {["Shopping", "To do at home", "Ideas"].map((title) => (
            <Button key={title} variant="outline" size="sm" onClick={() => add.mutate(title)}>
              <Plus className="size-4" /> {title}
            </Button>
          ))}
        </div>
      ) : null}
      <form
        className="flex max-w-md gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (newList.trim()) add.mutate(newList.trim());
        }}
      >
        <Input
          className="h-11"
          placeholder="New list"
          maxLength={80}
          value={newList}
          onChange={(e) => setNewList(e.target.value)}
        />
        <Button type="submit" className="h-11" disabled={!newList.trim() || add.isPending}>
          Add list
        </Button>
      </form>
    </div>
  );
}

function ListCard({
  list,
  items,
  onChanged,
}: {
  list: PodList;
  items: { id: string; text: string; done: boolean }[];
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [removing, setRemoving] = useState(false);
  const onError = (error: unknown) => toast.error(toError(error).message);
  const add = useMutation({
    mutationFn: async (value: string) => {
      // Several lines at once become several items.
      for (const line of value
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 50)) {
        await addPodItem(list, line.slice(0, 300));
      }
    },
    onSuccess: () => {
      setText("");
      onChanged();
    },
    onError,
  });
  const tick = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => setPodItemDone(id, done, user!.id),
    onSuccess: onChanged,
    onError,
  });
  const remove = useMutation({ mutationFn: deletePodItem, onSuccess: onChanged, onError });
  const clear = useMutation({
    mutationFn: () => clearDoneItems(list.id),
    onSuccess: onChanged,
    onError,
  });
  const drop = useMutation({
    mutationFn: () => deletePodList(list.id),
    onSuccess: onChanged,
    onError,
  });
  const doneCount = items.filter((item) => item.done).length;

  return (
    <section className="stat-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{list.title}</p>
        <div className="flex gap-1">
          {doneCount ? (
            <Button size="sm" variant="ghost" onClick={() => clear.mutate()}>
              Clear {doneCount} ticked
            </Button>
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Delete ${list.title}`}
            onClick={() => setRemoving(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="group flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-[var(--primary)]"
              checked={item.done}
              aria-label={item.text}
              onChange={(e) => tick.mutate({ id: item.id, done: e.target.checked })}
            />
            <span
              className={cn("flex-1 text-sm", item.done && "text-muted-foreground line-through")}
            >
              {item.text}
            </span>
            <button
              type="button"
              aria-label={`Remove ${item.text}`}
              className="text-muted-foreground opacity-60 hover:opacity-100"
              onClick={() => remove.mutate(item.id)}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim()) add.mutate(text);
        }}
      >
        <Input
          className="h-11"
          placeholder="Add an item"
          dir="auto"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" className="h-11" disabled={!text.trim() || add.isPending}>
          Add
        </Button>
      </form>
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={`Delete "${list.title}" for everyone?`}
        description="Everyone in the space loses this list and its items."
        onConfirm={() => drop.mutate()}
      />
    </section>
  );
}

function SharedCalendar({ pod }: { pod: Pod }) {
  const queryClient = useQueryClient();
  const events = useQuery({ ...podEventsQuery(), refetchInterval: LIVE });
  const members = useQuery(podMembersQuery());
  const { fmtTime, fmtLongDate } = usePreferences();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: togetherKeys.events });
  const onError = (error: unknown) => toast.error(toError(error).message);

  const add = useMutation({
    mutationFn: () =>
      addPodEvent({
        pod_id: pod.id,
        title: title.trim(),
        note: null,
        starts_at: new Date(`${date}T${time || "00:00"}:00`).toISOString(),
        ends_at: null,
        all_day: !time,
      }),
    onSuccess: () => {
      setTitle("");
      setTime("");
      invalidate();
    },
    onError,
  });
  const remove = useMutation({ mutationFn: deletePodEvent, onSuccess: invalidate, onError });

  const names = new Map(
    (members.data ?? []).filter((m) => m.pod_id === pod.id).map((m) => [m.user_id, m.display_name]),
  );
  const byDay = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof events.data>>();
    for (const event of (events.data ?? []).filter((item) => item.pod_id === pod.id)) {
      const day = format(parseISO(event.starts_at), "yyyy-MM-dd");
      groups.set(day, [...(groups.get(day) ?? []), event]);
    }
    return [...groups.entries()];
  }, [events.data, pod.id]);

  if (events.isLoading) return <LoadingState rows={2} />;

  return (
    <div className="space-y-4">
      <form
        className="stat-card grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim()) add.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="pod-event">What</Label>
          <Input
            id="pod-event"
            className="h-11"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dinner at mum's"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pod-date">Day</Label>
          <DatePicker id="pod-date" value={date} onChange={(value) => value && setDate(value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pod-time">Time (optional)</Label>
          <Input
            id="pod-time"
            type="time"
            className="h-11 w-32"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <Button type="submit" className="h-11" disabled={!title.trim() || add.isPending}>
          Add
        </Button>
      </form>

      {byDay.length ? (
        byDay.map(([day, list]) => {
          const parsed = parseISO(day);
          return (
            <section key={day} className="space-y-2">
              <p className="text-sm font-semibold">
                {isToday(parsed) ? "Today" : isTomorrow(parsed) ? "Tomorrow" : fmtLongDate(parsed)}
              </p>
              <ul className="space-y-2">
                {list.map((event) => (
                  <li
                    key={event.id}
                    className="stat-card flex items-center justify-between gap-3 p-3"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{event.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {event.all_day ? "All day" : fmtTime(parseISO(event.starts_at))}
                        {event.created_by && names.get(event.created_by)
                          ? ` · added by ${names.get(event.created_by)}`
                          : ""}
                      </span>
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${event.title}`}
                      onClick={() => remove.mutate(event.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      ) : (
        <p className="text-sm text-muted-foreground">Nothing on the shared calendar yet.</p>
      )}
    </div>
  );
}
