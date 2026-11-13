import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { ListTree, Map as MapIcon, Settings2, UserPlus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { PersonForm } from "@/components/app/relationships/PersonForm";
import { PersonSheet } from "@/components/app/relationships/PersonSheet";
import { RelationshipMap } from "@/components/app/relationships/RelationshipMap";
import { RuleEditor } from "@/components/app/relationships/RuleEditor";
import { useRelationships } from "@/components/app/relationships/useRelationships";
import { Button } from "@/components/ui/button";
import {
  CIRCLES,
  INTERACTION_KINDS,
  cadenceLabel,
  checkInState,
  daysAgo,
  daysUntilBirthday,
  layoutMap,
  litSet,
  relationLabel,
  type Circle,
  type Interaction,
  type LinkKind,
  type Person,
  type PersonLink,
} from "@/data/relationships";
import {
  createLink,
  createPerson,
  createRule,
  deleteInteraction,
  deleteLink,
  deletePerson,
  deleteRule,
  ensureMe,
  logInteraction,
  updatePerson,
  type PersonInput,
  type RuleInput,
} from "@/data/relationshipsApi";
import { todayISO } from "@/lib/date";
import { toError } from "@/lib/supabase-helpers";

export const Route = createFileRoute("/_authenticated/relationships")({
  head: () => ({
    meta: [
      { title: "Relationships · Life OS" },
      {
        name: "description",
        content: "A map of your people, the check-ins you choose, and birthdays.",
      },
    ],
  }),
  component: RelationshipsPage,
});

type ViewMode = "map" | "list";
const VIEW_KEY = "lifeos:people-view";

function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "map";
  } catch {
    return "map";
  }
}

function RelationshipsPage() {
  const data = useRelationships();
  const today = todayISO();
  const [view, setViewState] = useState<ViewMode>(readView);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; person: Person | null }>({
    open: false,
    person: null,
  });
  const [rulesOpen, setRulesOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Person | null>(null);

  const setView = (next: ViewMode) => {
    setViewState(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Remembered for this visit only.
    }
  };

  const layout = useMemo(() => layoutMap(data.people, data.links), [data.people, data.links]);
  const me = data.people.find((person) => person.is_me) ?? null;
  const selected = data.people.find((person) => person.id === selectedId) ?? null;
  const sheetPerson = data.people.find((person) => person.id === sheetId) ?? null;
  const onSelect = useCallback((id: string | null) => setSelectedId(id), []);

  const fail = (error: unknown) => toast.error(toError(error).message);
  const savePerson = useMutation({
    mutationFn: async ({
      input,
      link,
    }: {
      input: PersonInput;
      link: { to: string; kind: LinkKind } | null;
    }) => {
      if (form.person) return updatePerson(form.person.id, input);
      const centre = await ensureMe(data.people);
      const created = await createPerson(input);
      const to = !link || link.to === placeholderMe.id ? centre.id : link.to;
      await createLink({ from_person: created.id, to_person: to, kind: link?.kind ?? "other" });
      return created;
    },
    onSuccess: async (person) => {
      setForm({ open: false, person: null });
      await data.refresh();
      setSelectedId(person.id);
      toast.success(form.person ? "Saved." : `${person.name} added.`);
    },
    onError: fail,
  });
  const removePerson = useMutation({
    mutationFn: (person: Person) => deletePerson(person.id),
    onSuccess: async () => {
      setToDelete(null);
      setSheetId(null);
      setSelectedId(null);
      await data.refresh();
    },
    onError: fail,
  });
  const log = useMutation({
    mutationFn: (input: { person_id: string; kind: Interaction["kind"]; note: string | null }) =>
      logInteraction({ ...input, occurred_on: today }),
    onSuccess: () => void data.refresh(),
    onError: fail,
  });
  const unlog = useMutation({
    mutationFn: (item: Interaction) => deleteInteraction(item.id),
    onSuccess: () => void data.refresh(),
    onError: fail,
  });
  const link = useMutation({
    mutationFn: (input: Omit<PersonLink, "id">) => createLink(input),
    onSuccess: () => void data.refresh(),
    onError: fail,
  });
  const unlink = useMutation({
    mutationFn: (item: PersonLink) => deleteLink(item.id),
    onSuccess: () => void data.refresh(),
    onError: fail,
  });
  const addRule = useMutation({
    mutationFn: (input: RuleInput) => createRule(input),
    onSuccess: () => {
      void data.refresh();
      toast.success("Rule added.");
    },
    onError: fail,
  });
  const removeRule = useMutation({
    mutationFn: (id: string) => deleteRule(id),
    onSuccess: () => void data.refresh(),
    onError: fail,
  });

  const openAdd = () => setForm({ open: true, person: null });

  if (data.isLoading) return <LoadingState rows={4} />;

  if (data.needsSetup) {
    return (
      <>
        <PageHeader title="Relationships" />
        <EmptyState
          title="Almost ready"
          description="Relationships needs a one-time database update before it can save anything. Until then you can try it with sample people in the demo."
        />
      </>
    );
  }
  if (data.error) return <ErrorState error={data.error} onRetry={data.retry} />;

  const others = data.people.filter((person) => !person.is_me);

  return (
    <>
      <PageHeader
        title="Relationships"
        description="Your people, how they connect to you, and when you last spoke. Nothing here is scored."
        actions={
          <>
            <Button variant="outline" onClick={() => setRulesOpen(true)}>
              <Settings2 className="size-4" /> Rules
            </Button>
            <Button onClick={openAdd}>
              <UserPlus className="size-4" /> Add person
            </Button>
          </>
        }
      />

      {!others.length ? (
        <EmptyState
          title="Start with one person"
          description="Add someone close: a parent, a sibling, a friend. Then add the people they connect to, and the map grows from you outward."
          action={<Button onClick={openAdd}>Add person</Button>}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label="View"
              className="inline-flex rounded-lg bg-secondary p-1"
            >
              {(
                [
                  { value: "map", label: "Map", icon: MapIcon },
                  { value: "list", label: "List", icon: ListTree },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={view === value}
                  onClick={() => setView(value)}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-colors ${
                    view === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selected
                ? "Tap empty space or press Esc to clear"
                : "Tap someone to light up their side"}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            {view === "map" ? (
              <RelationshipMap
                layout={layout}
                links={data.links}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ) : (
              <PeopleList
                people={data.people}
                interactions={data.interactions}
                lit={litSet(layout, data.links, selectedId)}
                selectedId={selectedId}
                onSelect={onSelect}
                today={today}
              />
            )}

            <SelectedPanel
              person={selected}
              interactions={data.interactions}
              today={today}
              pending={log.isPending}
              onDetails={(person) => setSheetId(person.id)}
              onLog={(person, kind) => log.mutate({ person_id: person.id, kind, note: null })}
            />
          </div>
        </div>
      )}

      <PersonForm
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        person={form.person}
        people={me ? data.people : [{ ...placeholderMe }, ...data.people]}
        defaultLinkTo={selected?.id ?? me?.id ?? placeholderMe.id}
        pending={savePerson.isPending}
        onSave={(input, linkTo) => savePerson.mutate({ input, link: linkTo })}
      />
      <PersonSheet
        person={sheetPerson}
        people={data.people}
        links={data.links}
        interactions={data.interactions}
        today={today}
        onOpenChange={(open) => {
          if (!open) setSheetId(null);
        }}
        onEdit={(person) => setForm({ open: true, person })}
        onDelete={(person) => setToDelete(person)}
        onLog={(input) => log.mutate(input)}
        onDeleteLog={(item) => unlog.mutate(item)}
        onLink={(input) => link.mutate(input)}
        onUnlink={(item) => unlink.mutate(item)}
      />
      <RuleEditor
        open={rulesOpen}
        onOpenChange={setRulesOpen}
        rules={data.rules}
        people={data.people}
        pending={addRule.isPending}
        onCreate={(input) => addRule.mutate(input)}
        onDelete={(rule) => removeRule.mutate(rule.id)}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Delete ${toDelete?.name ?? "this person"}?`}
        description="Their log and links go too. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (toDelete) removePerson.mutate(toDelete);
        }}
      />
    </>
  );
}

/** Stands in for "Me" in the form before Me exists; never saved as is. */
const placeholderMe: Person = {
  id: "__me__",
  is_me: true,
  name: "Me",
  relation: "me",
  circle: "me",
  birthday_month: null,
  birthday_day: null,
  birth_year: null,
  phone: null,
  notes: null,
  goal: null,
  checkin_every_days: null,
  checkin_since: null,
};

function lastLine(person: Person, interactions: Interaction[], today: string): string {
  const state = checkInState(person, interactions, today);
  const last =
    state?.last ??
    interactions
      .filter((item) => item.person_id === person.id && item.kind !== "note")
      .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))[0] ??
    null;
  if (!last) return person.checkin_every_days ? "No contact logged yet" : "Nothing logged";
  const days = Math.max(0, differenceInCalendarDays(parseISO(today), parseISO(last.occurred_on)));
  const past = INTERACTION_KINDS.find((kind) => kind.value === last.kind)?.past ?? "contact";
  return `Last ${past} ${daysAgo(days)}`;
}

/** The selected person, inline beside the map: a summary and one-tap logging. */
function SelectedPanel({
  person,
  interactions,
  today,
  pending,
  onDetails,
  onLog,
}: {
  person: Person | null;
  interactions: Interaction[];
  today: string;
  pending: boolean;
  onDetails: (person: Person) => void;
  onLog: (person: Person, kind: Interaction["kind"]) => void;
}) {
  if (!person) {
    return (
      <aside className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Select someone to see their side of the family, when you last spoke, and to log a call.
      </aside>
    );
  }
  const birthdayIn = daysUntilBirthday(person, today);
  return (
    <aside aria-live="polite" className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <p className="text-lg font-semibold">{person.is_me ? "Me" : person.name}</p>
        {person.is_me ? null : (
          <p className="text-sm text-muted-foreground">{relationLabel(person.relation)}</p>
        )}
      </div>
      {person.is_me ? (
        <p className="text-sm text-muted-foreground">Everyone on the map connects back to you.</p>
      ) : (
        <>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Contact</dt>
              <dd className="text-right">{lastLine(person, interactions, today)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Check in</dt>
              <dd className="text-right">{cadenceLabel(person.checkin_every_days)}</dd>
            </div>
            {birthdayIn !== null ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Birthday</dt>
                <dd className="text-right">
                  {birthdayIn === 0
                    ? "Today"
                    : birthdayIn === 1
                      ? "Tomorrow"
                      : `In ${birthdayIn} days`}
                </dd>
              </div>
            ) : null}
          </dl>
          {person.goal ? (
            <p className="rounded-xl bg-secondary p-2.5 text-sm">{person.goal}</p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {INTERACTION_KINDS.filter((kind) => kind.value !== "note").map((kind) => (
              <Button
                key={kind.value}
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => onLog(person, kind.value)}
              >
                {kind.label}
              </Button>
            ))}
          </div>
        </>
      )}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onDetails(person)}>
        Details
      </Button>
    </aside>
  );
}

/** The same people as the map, grouped by circle: the accessible view. */
function PeopleList({
  people,
  interactions,
  lit,
  selectedId,
  onSelect,
  today,
}: {
  people: Person[];
  interactions: Interaction[];
  lit: Set<string> | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  today: string;
}) {
  const groups: { circle: Circle; label: string; people: Person[] }[] = CIRCLES.map((circle) => ({
    circle: circle.value,
    label: circle.label,
    people: people.filter((person) => person.circle === circle.value),
  })).filter((group) => group.people.length);

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-4">
      {groups.map((group) => (
        <section key={group.circle} aria-labelledby={`circle-${group.circle}`}>
          <h2 id={`circle-${group.circle}`} className="section-title mb-2">
            {group.label}
          </h2>
          <ul className="space-y-1">
            {group.people.map((person) => {
              const selected = person.id === selectedId;
              const dimmed = lit ? !lit.has(person.id) : false;
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    data-lit={lit ? String(!dimmed) : undefined}
                    onClick={() => onSelect(selected ? null : person.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-[opacity,background-color] duration-200 motion-reduce:transition-none ${
                      selected
                        ? "bg-primary/10 ring-1 ring-primary"
                        : lit && !dimmed
                          ? "bg-primary/5"
                          : "hover:bg-accent"
                    } ${dimmed ? "opacity-40" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{person.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {relationLabel(person.relation)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {lastLine(person, interactions, today)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
