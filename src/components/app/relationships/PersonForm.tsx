import { useEffect, useState, type ReactNode } from "react";

import { FormDialog } from "@/components/app/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CADENCES,
  CIRCLES,
  LINK_KINDS,
  RELATIONS,
  type Circle,
  type LinkKind,
  type Person,
  type Relation,
} from "@/data/relationships";
import type { PersonInput } from "@/data/relationshipsApi";

import { defaultCircle, defaultLinkKind, selectClass } from "./personFormHelpers";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Draft = {
  name: string;
  relation: Exclude<Relation, "me">;
  circle: Exclude<Circle, "me">;
  circleTouched: boolean;
  month: string;
  day: string;
  year: string;
  phone: string;
  notes: string;
  goal: string;
  cadence: string;
  linkTo: string;
  linkKind: LinkKind;
  linkTouched: boolean;
};

const fromPerson = (person: Person | null, linkTo: string): Draft => ({
  name: person?.name ?? "",
  relation: (person && person.relation !== "me" ? person.relation : "friend") as Draft["relation"],
  circle: (person && person.circle !== "me" ? person.circle : "friends") as Draft["circle"],
  circleTouched: !!person,
  month: person?.birthday_month ? String(person.birthday_month) : "",
  day: person?.birthday_day ? String(person.birthday_day) : "",
  year: person?.birth_year ? String(person.birth_year) : "",
  phone: person?.phone ?? "",
  notes: person?.notes ?? "",
  goal: person?.goal ?? "",
  cadence: person?.checkin_every_days ? String(person.checkin_every_days) : "",
  linkTo,
  linkKind: "friend",
  linkTouched: false,
});

/**
 * Add or edit a person. Adding also asks who they connect to (Me by default)
 * and how, so they land in the right place on the map.
 */
export function PersonForm({
  open,
  onOpenChange,
  person,
  people,
  defaultLinkTo,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: Person | null;
  people: Person[];
  defaultLinkTo: string | null;
  pending?: boolean;
  onSave: (input: PersonInput, link: { to: string; kind: LinkKind } | null) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => fromPerson(person, defaultLinkTo ?? ""));
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setDraft(fromPerson(person, defaultLinkTo ?? ""));
      setProblem(null);
    }
  }, [open, person, defaultLinkTo]);
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const submit = () => {
    const name = draft.name.trim();
    if (!name) return setProblem("Add a name.");
    if (!!draft.month !== !!draft.day)
      return setProblem("Pick both the day and the month, or neither.");
    const cadence = draft.cadence ? Number(draft.cadence) : null;
    const previous = person?.checkin_every_days ?? null;
    onSave(
      {
        name,
        relation: draft.relation,
        circle: draft.circle,
        birthday_month: draft.month ? Number(draft.month) : null,
        birthday_day: draft.day ? Number(draft.day) : null,
        birth_year: draft.year ? Number(draft.year) : null,
        phone: draft.phone.trim() || null,
        notes: draft.notes.trim() || null,
        goal: draft.goal.trim() || null,
        checkin_every_days: cadence,
        // A new rhythm starts counting today, unless contact is already logged.
        checkin_since:
          cadence && cadence !== previous
            ? new Date().toISOString().slice(0, 10)
            : (person?.checkin_since ?? null),
      },
      !person && draft.linkTo ? { to: draft.linkTo, kind: draft.linkKind } : null,
    );
  };

  const others = people.filter((other) => other.id !== person?.id);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={person ? `Edit ${person.name}` : "Add a person"}
      submitLabel={person ? "Save" : "Add"}
      pending={pending ?? false}
      onSubmit={submit}
    >
      <Field label="Name" htmlFor="person-name">
        <Input
          id="person-name"
          value={draft.name}
          maxLength={80}
          autoFocus
          onChange={(event) => set({ name: event.target.value })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Who they are to you" htmlFor="person-relation">
          <select
            id="person-relation"
            className={selectClass}
            value={draft.relation}
            onChange={(event) => {
              const relation = event.target.value as Draft["relation"];
              set({
                relation,
                ...(draft.circleTouched ? {} : { circle: defaultCircle(relation) }),
                ...(draft.linkTouched ? {} : { linkKind: defaultLinkKind(relation) }),
              });
            }}
          >
            {RELATIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Circle" htmlFor="person-circle">
          <select
            id="person-circle"
            className={selectClass}
            value={draft.circle}
            onChange={(event) =>
              set({ circle: event.target.value as Draft["circle"], circleTouched: true })
            }
          >
            {CIRCLES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {!person && others.length ? (
        <div className="grid gap-4 rounded-xl bg-secondary p-3 sm:grid-cols-2">
          <Field label="Connected to" htmlFor="person-link-to">
            <select
              id="person-link-to"
              className={selectClass}
              value={draft.linkTo}
              onChange={(event) => set({ linkTo: event.target.value })}
            >
              {others.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.is_me ? "Me" : other.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="As their" htmlFor="person-link-kind">
            <select
              id="person-link-kind"
              className={selectClass}
              value={draft.linkKind}
              onChange={(event) =>
                set({ linkKind: event.target.value as LinkKind, linkTouched: true })
              }
            >
              {LINK_KINDS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label.replace(/ of$/, "")}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      <Field label="Check in" htmlFor="person-cadence">
        <select
          id="person-cadence"
          className={selectClass}
          value={draft.cadence}
          onChange={(event) => set({ cadence: event.target.value })}
        >
          {CADENCES.map((item) => (
            <option key={item.label} value={item.days ?? ""}>
              {item.label}
            </option>
          ))}
          {draft.cadence && !CADENCES.some((item) => String(item.days) === draft.cadence) ? (
            <option value={draft.cadence}>Every {draft.cadence} days</option>
          ) : null}
        </select>
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Birthday</legend>
        <div className="grid grid-cols-[1fr_2fr_1.4fr] gap-2">
          <select
            aria-label="Birthday day"
            className={selectClass}
            value={draft.day}
            onChange={(event) => set({ day: event.target.value })}
          >
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, index) => (
              <option key={index} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
          <select
            aria-label="Birthday month"
            className={selectClass}
            value={draft.month}
            onChange={(event) => set({ month: event.target.value })}
          >
            <option value="">Month</option>
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
          <Input
            aria-label="Birth year (optional)"
            inputMode="numeric"
            placeholder="Year (optional)"
            value={draft.year}
            maxLength={4}
            onChange={(event) => set({ year: event.target.value.replace(/\D/g, "") })}
          />
        </div>
      </fieldset>

      <details className="group rounded-xl border border-border px-3 py-2" open={!!person}>
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
          Goal, phone and notes
        </summary>
        <div className="mt-3 space-y-4">
          <Field label="Goal with them (optional)" htmlFor="person-goal">
            <Input
              id="person-goal"
              value={draft.goal}
              maxLength={500}
              placeholder="Visit once a month"
              onChange={(event) => set({ goal: event.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone (optional)" htmlFor="person-phone">
              <Input
                id="person-phone"
                type="tel"
                value={draft.phone}
                maxLength={40}
                onChange={(event) => set({ phone: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Notes (optional)" htmlFor="person-notes">
            <Textarea
              id="person-notes"
              rows={3}
              value={draft.notes}
              maxLength={4000}
              onChange={(event) => set({ notes: event.target.value })}
            />
          </Field>
        </div>
      </details>
      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
    </FormDialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
