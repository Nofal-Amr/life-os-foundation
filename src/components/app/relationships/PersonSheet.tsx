import { format, parseISO } from "date-fns";
import { Cake, Link2, Pencil, Phone, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  INTERACTION_KINDS,
  LINK_KINDS,
  cadenceLabel,
  checkInState,
  circleLabel,
  daysAgo,
  daysUntilBirthday,
  nextBirthday,
  relationLabel,
  turningAge,
  type Interaction,
  type InteractionKind,
  type LinkKind,
  type Person,
  type PersonLink,
} from "@/data/relationships";

import { selectClass } from "./personFormHelpers";

/**
 * Everything about one person: who they are, the rhythm you chose, your goal,
 * and the dated log, which is the progress. Opened on purpose from "Details".
 */
export function PersonSheet({
  person,
  people,
  links,
  interactions,
  today,
  onOpenChange,
  onEdit,
  onDelete,
  onLog,
  onDeleteLog,
  onLink,
  onUnlink,
}: {
  person: Person | null;
  people: Person[];
  links: PersonLink[];
  interactions: Interaction[];
  today: string;
  onOpenChange: (open: boolean) => void;
  onEdit: (person: Person) => void;
  onDelete: (person: Person) => void;
  onLog: (input: { person_id: string; kind: InteractionKind; note: string | null }) => void;
  onDeleteLog: (interaction: Interaction) => void;
  onLink: (input: { from_person: string; to_person: string; kind: LinkKind }) => void;
  onUnlink: (link: PersonLink) => void;
}) {
  const [note, setNote] = useState("");
  const [linkTo, setLinkTo] = useState("");
  const [linkKind, setLinkKind] = useState<LinkKind>("sibling");

  return (
    <Sheet open={!!person} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {person ? (
          <SheetBody
            key={person.id}
            {...{
              person,
              people,
              links,
              interactions,
              today,
              onEdit,
              onDelete,
              onLog,
              onDeleteLog,
              onLink,
              onUnlink,
            }}
            note={note}
            setNote={setNote}
            linkTo={linkTo}
            setLinkTo={setLinkTo}
            linkKind={linkKind}
            setLinkKind={setLinkKind}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({
  person,
  people,
  links,
  interactions,
  today,
  onEdit,
  onDelete,
  onLog,
  onDeleteLog,
  onLink,
  onUnlink,
  note,
  setNote,
  linkTo,
  setLinkTo,
  linkKind,
  setLinkKind,
}: {
  person: Person;
  people: Person[];
  links: PersonLink[];
  interactions: Interaction[];
  today: string;
  onEdit: (person: Person) => void;
  onDelete: (person: Person) => void;
  onLog: (input: { person_id: string; kind: InteractionKind; note: string | null }) => void;
  onDeleteLog: (interaction: Interaction) => void;
  onLink: (input: { from_person: string; to_person: string; kind: LinkKind }) => void;
  onUnlink: (link: PersonLink) => void;
  note: string;
  setNote: (value: string) => void;
  linkTo: string;
  setLinkTo: (value: string) => void;
  linkKind: LinkKind;
  setLinkKind: (value: LinkKind) => void;
}) {
  const name = (id: string) => {
    const other = people.find((item) => item.id === id);
    return other?.is_me ? "Me" : (other?.name ?? "Someone");
  };
  const state = checkInState(person, interactions, today);
  const log = interactions
    .filter((item) => item.person_id === person.id)
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  const mine = links.filter(
    (link) => link.from_person === person.id || link.to_person === person.id,
  );
  const birthday = nextBirthday(person, today);
  const inDays = daysUntilBirthday(person, today);
  const age = turningAge(person, today);
  const candidates = people.filter(
    (other) =>
      other.id !== person.id &&
      !mine.some((link) => link.from_person === other.id || link.to_person === other.id),
  );

  return (
    <div className="space-y-6 pb-6">
      <div className="pr-8">
        <SheetTitle className="text-xl">{person.is_me ? "Me" : person.name}</SheetTitle>
        <SheetDescription>
          {person.is_me
            ? "The centre of your map."
            : `${relationLabel(person.relation)} · ${circleLabel(person.circle)}`}
        </SheetDescription>
      </div>

      {person.is_me ? null : (
        <section className="space-y-2 text-sm">
          <p className="tabular-nums">
            <span className="text-muted-foreground">Check in: </span>
            {cadenceLabel(person.checkin_every_days)}
            {state
              ? state.last
                ? ` · last ${INTERACTION_KINDS.find((item) => item.value === state.last!.kind)?.past} ${daysAgo(state.daysSince)}`
                : " · no contact logged yet"
              : ""}
          </p>
          {birthday ? (
            <p className="flex items-center gap-2 tabular-nums">
              <Cake className="size-4 text-muted-foreground" aria-hidden="true" />
              {format(parseISO(birthday), "d MMMM")}
              {inDays === 0 ? " · today" : inDays === 1 ? " · tomorrow" : ` · in ${inDays} days`}
              {age ? ` · turns ${age}` : ""}
            </p>
          ) : null}
          {person.phone ? (
            <p className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
              <a className="underline-offset-2 hover:underline" href={`tel:${person.phone}`}>
                {person.phone}
              </a>
            </p>
          ) : null}
          {person.goal ? (
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-xs font-medium text-muted-foreground">Goal</p>
              <p className="mt-0.5">{person.goal}</p>
            </div>
          ) : null}
          {person.notes ? (
            <p className="whitespace-pre-line text-muted-foreground">{person.notes}</p>
          ) : null}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(person)}>
          <Pencil className="size-4" /> Edit
        </Button>
        {person.is_me ? null : (
          <Button variant="ghost" size="sm" onClick={() => onDelete(person)}>
            <Trash2 className="size-4" /> Delete
          </Button>
        )}
      </div>

      {person.is_me ? null : (
        <section className="space-y-3">
          <h3 className="section-title">Log</h3>
          <Input
            aria-label="Note for this entry (optional)"
            placeholder="A note (optional)"
            value={note}
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {INTERACTION_KINDS.map((kind) => (
              <Button
                key={kind.value}
                size="sm"
                variant={kind.value === "note" ? "ghost" : "secondary"}
                disabled={kind.value === "note" && !note.trim()}
                onClick={() => {
                  onLog({ person_id: person.id, kind: kind.value, note: note.trim() || null });
                  setNote("");
                }}
              >
                {kind.value === "note" ? "Add note" : kind.label}
              </Button>
            ))}
          </div>
          {log.length ? (
            <ol className="space-y-2" aria-label={`Log for ${person.name}`}>
              {log.map((item) => (
                <li key={item.id} className="group flex items-start gap-3 text-sm">
                  <span className="w-20 shrink-0 tabular-nums text-muted-foreground">
                    {format(parseISO(item.occurred_on), "d MMM")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">
                      {INTERACTION_KINDS.find((kind) => kind.value === item.kind)?.label}
                    </span>
                    {item.note ? (
                      <span className="text-muted-foreground"> · {item.note}</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove this entry"
                    className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-60 hover:bg-accent hover:opacity-100"
                    onClick={() => onDeleteLog(item)}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="section-title">Connections</h3>
        {mine.length ? (
          <ul className="space-y-1.5 text-sm">
            {mine.map((link) => {
              const word =
                LINK_KINDS.find((kind) => kind.value === link.kind)?.label ?? "linked to";
              return (
                <li key={link.id} className="flex items-center gap-2">
                  <Link2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    {name(link.from_person)} is {word} {name(link.to_person)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove link with ${name(link.from_person === person.id ? link.to_person : link.from_person)}`}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                    onClick={() => onUnlink(link)}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Not linked to anyone yet.</p>
        )}
        {candidates.length ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const to = linkTo || candidates[0]!.id;
              onLink({ from_person: person.id, to_person: to, kind: linkKind });
              setLinkTo("");
            }}
          >
            <span className="w-full text-sm text-muted-foreground">
              {person.is_me ? "Me" : person.name} is
            </span>
            <select
              aria-label="Kind of link"
              className={`${selectClass} w-32`}
              value={linkKind}
              onChange={(event) => setLinkKind(event.target.value as LinkKind)}
            >
              {LINK_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Person to link"
              className={`${selectClass} min-w-0 flex-1`}
              value={linkTo || candidates[0]!.id}
              onChange={(event) => setLinkTo(event.target.value)}
            >
              {candidates.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.is_me ? "Me" : other.name}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="outline">
              Link
            </Button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
