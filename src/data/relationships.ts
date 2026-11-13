/**
 * Relationships: the people in your life, how they connect to you, when you
 * last spoke, and which reminders you want. Everything here is pure: the
 * reminder rules, the check-in rhythm, birthdays and the map layout. Nothing
 * is scored. "Last contact" is only ever what the user logged.
 */
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

export type Circle = "me" | "closest" | "family" | "relatives" | "friends" | "work";
export type Relation =
  | "me"
  | "father"
  | "mother"
  | "parent"
  | "sibling"
  | "spouse"
  | "child"
  | "grandparent"
  | "uncle_aunt"
  | "cousin"
  | "nephew_niece"
  | "relative"
  | "friend"
  | "colleague"
  | "other";
export type LinkKind =
  "parent" | "child" | "sibling" | "spouse" | "cousin" | "friend" | "colleague" | "other";
export type InteractionKind = "call" | "message" | "visit" | "met" | "note";
export type RuleTopic = "birthday" | "checkin" | "both";
export type RuleAction = "remind" | "quiet";
export type ScopeType = "everyone" | "circle" | "relation" | "person";

export type Person = {
  id: string;
  user_id?: string;
  is_me: boolean;
  name: string;
  relation: Relation;
  circle: Circle;
  birthday_month: number | null;
  birthday_day: number | null;
  birth_year: number | null;
  phone: string | null;
  notes: string | null;
  goal: string | null;
  checkin_every_days: number | null;
  /** When the rhythm was set; counts as "last contact" until one is logged. */
  checkin_since: string | null;
  created_at?: string;
};

export type PersonLink = {
  id: string;
  /** "from is <kind> of to": Father --parent--> Me. */
  from_person: string;
  to_person: string;
  kind: LinkKind;
};

export type Interaction = {
  id: string;
  person_id: string;
  kind: InteractionKind;
  occurred_on: string;
  note: string | null;
  created_at?: string;
};

export type Rule = {
  id: string;
  scope_type: ScopeType;
  scope_value: string | null;
  topic: RuleTopic;
  action: RuleAction;
  except_person_ids: string[];
  created_at?: string;
};

/* ---------- Words ---------- */

export const CIRCLES: { value: Exclude<Circle, "me">; label: string; plural: string }[] = [
  { value: "closest", label: "Closest", plural: "closest people" },
  { value: "family", label: "Family", plural: "family" },
  { value: "relatives", label: "Relatives", plural: "relatives" },
  { value: "friends", label: "Friends", plural: "friends" },
  { value: "work", label: "Work", plural: "work people" },
];

export const RELATIONS: { value: Exclude<Relation, "me">; label: string; plural: string }[] = [
  { value: "father", label: "Father", plural: "father" },
  { value: "mother", label: "Mother", plural: "mother" },
  { value: "parent", label: "Parent", plural: "parents" },
  { value: "sibling", label: "Sibling", plural: "siblings" },
  { value: "spouse", label: "Spouse", plural: "spouse" },
  { value: "child", label: "Child", plural: "children" },
  { value: "grandparent", label: "Grandparent", plural: "grandparents" },
  { value: "uncle_aunt", label: "Uncle or aunt", plural: "uncles and aunts" },
  { value: "cousin", label: "Cousin", plural: "cousins" },
  { value: "nephew_niece", label: "Nephew or niece", plural: "nephews and nieces" },
  { value: "relative", label: "Relative", plural: "relatives" },
  { value: "friend", label: "Friend", plural: "friends" },
  { value: "colleague", label: "Colleague", plural: "colleagues" },
  { value: "other", label: "Other", plural: "others" },
];

export const LINK_KINDS: { value: LinkKind; label: string }[] = [
  { value: "parent", label: "parent of" },
  { value: "child", label: "child of" },
  { value: "sibling", label: "sibling of" },
  { value: "spouse", label: "spouse of" },
  { value: "cousin", label: "cousin of" },
  { value: "friend", label: "friend of" },
  { value: "colleague", label: "colleague of" },
  { value: "other", label: "linked to" },
];

export const INTERACTION_KINDS: { value: InteractionKind; label: string; past: string }[] = [
  { value: "call", label: "Called", past: "call" },
  { value: "message", label: "Messaged", past: "message" },
  { value: "visit", label: "Visited", past: "visit" },
  { value: "met", label: "Met", past: "meeting" },
  { value: "note", label: "Note", past: "note" },
];

export const CADENCES: { days: number | null; label: string }[] = [
  { days: null, label: "No check-ins" },
  { days: 3, label: "Every 3 days" },
  { days: 7, label: "Every week" },
  { days: 14, label: "Every 2 weeks" },
  { days: 30, label: "Every month" },
  { days: 90, label: "Every 3 months" },
];

export function cadenceLabel(days: number | null): string {
  if (!days) return "No check-ins";
  const preset = CADENCES.find((item) => item.days === days);
  return preset ? preset.label : `Every ${days} days`;
}

export const relationLabel = (relation: Relation) =>
  relation === "me" ? "Me" : (RELATIONS.find((item) => item.value === relation)?.label ?? relation);
export const circleLabel = (circle: Circle) =>
  circle === "me" ? "Me" : (CIRCLES.find((item) => item.value === circle)?.label ?? circle);

/** "12 days ago", "yesterday", "today". */
export function daysAgo(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/* ---------- Rules ---------- */

const SPECIFICITY: Record<ScopeType, number> = { everyone: 0, circle: 1, relation: 2, person: 3 };

export function ruleApplies(rule: Rule, person: Person, topic: "birthday" | "checkin"): boolean {
  if (rule.topic !== "both" && rule.topic !== topic) return false;
  if (rule.except_person_ids.includes(person.id)) return false;
  if (rule.scope_type === "everyone") return true;
  if (rule.scope_type === "circle") return person.circle === rule.scope_value;
  if (rule.scope_type === "relation") return person.relation === rule.scope_value;
  return person.id === rule.scope_value;
}

/**
 * The rule that decides one person and one topic: the most specific one that
 * applies (person, then relation, then circle, then everyone); on a tie, the
 * newest. No rule means remind.
 */
export function decidingRule(
  rules: Rule[],
  person: Person,
  topic: "birthday" | "checkin",
): Rule | null {
  let best: Rule | null = null;
  for (const rule of rules) {
    if (!ruleApplies(rule, person, topic)) continue;
    if (
      !best ||
      SPECIFICITY[rule.scope_type] > SPECIFICITY[best.scope_type] ||
      (SPECIFICITY[rule.scope_type] === SPECIFICITY[best.scope_type] &&
        (rule.created_at ?? "") > (best.created_at ?? ""))
    ) {
      best = rule;
    }
  }
  return best;
}

export function wantsReminder(rules: Rule[], person: Person, topic: "birthday" | "checkin") {
  return (decidingRule(rules, person, topic)?.action ?? "remind") === "remind";
}

/** "Don't remind me of birthdays for cousins, except Sara." */
export function describeRule(rule: Rule, people: Person[]): string {
  const what =
    rule.topic === "birthday"
      ? "birthdays"
      : rule.topic === "checkin"
        ? "check-ins"
        : "birthdays or check-ins";
  const who =
    rule.scope_type === "everyone"
      ? "anyone"
      : rule.scope_type === "circle"
        ? (CIRCLES.find((item) => item.value === rule.scope_value)?.plural ?? rule.scope_value)
        : rule.scope_type === "relation"
          ? (RELATIONS.find((item) => item.value === rule.scope_value)?.plural ?? rule.scope_value)
          : (people.find((person) => person.id === rule.scope_value)?.name ?? "someone removed");
  const names = rule.except_person_ids
    .map((id) => people.find((person) => person.id === id)?.name)
    .filter(Boolean) as string[];
  const except = names.length ? `, except ${joinNames(names)}` : "";
  const verb = rule.action === "quiet" ? "Don't remind me of" : "Remind me of";
  return `${verb} ${what} for ${who}${except}.`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/* ---------- Birthdays ---------- */

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** The next birthday on or after `today` ("yyyy-MM-dd"). 29 Feb → 28 Feb in other years. */
export function nextBirthday(
  person: Pick<Person, "birthday_month" | "birthday_day">,
  today: string,
): string | null {
  const { birthday_month: month, birthday_day: day } = person;
  if (!month || !day) return null;
  const base = parseISO(today);
  for (const year of [base.getFullYear(), base.getFullYear() + 1]) {
    const realDay = month === 2 && day === 29 && !isLeap(year) ? 28 : day;
    const date = format(new Date(year, month - 1, realDay), "yyyy-MM-dd");
    if (date >= today) return date;
  }
  return null;
}

export function daysUntilBirthday(person: Person, today: string): number | null {
  const next = nextBirthday(person, today);
  return next ? differenceInCalendarDays(parseISO(next), parseISO(today)) : null;
}

/** The age they turn on the next birthday, when the year is known. */
export function turningAge(person: Person, today: string): number | null {
  const next = nextBirthday(person, today);
  if (!next || !person.birth_year) return null;
  return Number(next.slice(0, 4)) - person.birth_year;
}

/* ---------- Check-ins ---------- */

export function lastContact(personId: string, interactions: Interaction[]): Interaction | null {
  let last: Interaction | null = null;
  for (const item of interactions) {
    if (item.person_id !== personId || item.kind === "note") continue;
    if (!last || item.occurred_on > last.occurred_on) last = item;
  }
  return last;
}

export type CheckInState = {
  /** Days since the last logged contact (or since the rhythm was set). */
  daysSince: number;
  /** The day the next check-in comes round ("yyyy-MM-dd"). */
  nextOn: string;
  due: boolean;
  last: Interaction | null;
};

export function checkInState(
  person: Person,
  interactions: Interaction[],
  today: string,
): CheckInState | null {
  const every = person.checkin_every_days;
  if (!every || every < 1) return null;
  const last = lastContact(person.id, interactions);
  const from =
    last?.occurred_on ?? person.checkin_since ?? (person.created_at ?? today).slice(0, 10);
  const daysSince = Math.max(0, differenceInCalendarDays(parseISO(today), parseISO(from)));
  const nextOn = format(addDays(parseISO(from), every), "yyyy-MM-dd");
  return { daysSince, nextOn, due: nextOn <= today, last };
}

/* ---------- What shows in Today ---------- */

export const BIRTHDAY_LEAD_DAYS = 3;
export const MAX_CHECKINS_TODAY = 3;

export type Nudge =
  | {
      kind: "checkin";
      key: string;
      person: Person;
      title: string;
      detail: string;
      daysSince: number;
    }
  | {
      kind: "birthday";
      key: string;
      person: Person;
      title: string;
      detail: string;
      inDays: number;
    };

/**
 * Today's calm list: birthdays in the next few days (all of them), then at
 * most three check-ins, the longest since contact first. Rules decide which
 * people are included; snoozed keys are left out.
 */
export function todaysNudges(input: {
  people: Person[];
  interactions: Interaction[];
  rules: Rule[];
  today: string;
  snoozed?: (key: string) => boolean;
}): Nudge[] {
  const { people, interactions, rules, today, snoozed = () => false } = input;
  const birthdays: Nudge[] = [];
  const checkins: Extract<Nudge, { kind: "checkin" }>[] = [];
  for (const person of people) {
    if (person.is_me) continue;
    const inDays = daysUntilBirthday(person, today);
    if (
      inDays !== null &&
      inDays <= BIRTHDAY_LEAD_DAYS &&
      wantsReminder(rules, person, "birthday")
    ) {
      const key = `birthday-${person.id}-${nextBirthday(person, today)}`;
      if (!snoozed(key)) {
        const age = turningAge(person, today);
        birthdays.push({
          kind: "birthday",
          key,
          person,
          inDays,
          title: inDays === 0 ? `${person.name}'s birthday is today` : `${person.name}'s birthday`,
          detail:
            (inDays === 0 ? "Today" : inDays === 1 ? "Tomorrow" : `In ${inDays} days`) +
            (age ? ` · turns ${age}` : ""),
        });
      }
    }
    const state = checkInState(person, interactions, today);
    if (state?.due && wantsReminder(rules, person, "checkin")) {
      const key = `checkin-${person.id}`;
      if (!snoozed(key)) {
        const past = state.last
          ? INTERACTION_KINDS.find((item) => item.value === state.last!.kind)?.past
          : null;
        checkins.push({
          kind: "checkin",
          key,
          person,
          daysSince: state.daysSince,
          title: `Check in with ${person.name}`,
          detail: past
            ? `Last ${past} ${daysAgo(state.daysSince)}`
            : `No contact logged yet · ${cadenceLabel(person.checkin_every_days).toLowerCase()}`,
        });
      }
    }
  }
  birthdays.sort((a, b) =>
    a.kind === "birthday" && b.kind === "birthday" ? a.inDays - b.inDays : 0,
  );
  checkins.sort((a, b) => b.daysSince - a.daysSince);
  return [...birthdays, ...checkins.slice(0, MAX_CHECKINS_TODAY)];
}

/* ---------- The map ---------- */

const CIRCLE_RING: Record<Circle, number> = {
  me: 0,
  closest: 1,
  family: 2,
  friends: 2,
  relatives: 3,
  work: 3,
};
const CIRCLE_ORDER: Circle[] = ["me", "closest", "family", "friends", "relatives", "work"];

export type MapNode = {
  person: Person;
  /** The person this one hangs from on the map (null for Me). */
  parentId: string | null;
  ring: number;
  angle: number;
  x: number;
  y: number;
};

export type MapLayout = {
  nodes: Map<string, MapNode>;
  meId: string | null;
  rings: number;
};

/**
 * A calm, fixed layout: Me in the centre, rings outward, and each branch in
 * its own wedge, so "Father's side" is a real place on the map.
 */
export function layoutMap(people: Person[], links: PersonLink[], ringGap = 110): MapLayout {
  const nodes = new Map<string, MapNode>();
  if (!people.length) return { nodes, meId: null, rings: 0 };
  const me = people.find((person) => person.is_me) ?? null;
  const byId = new Map(people.map((person) => [person.id, person]));
  const neighbours = new Map<string, string[]>();
  for (const link of links) {
    if (!byId.has(link.from_person) || !byId.has(link.to_person)) continue;
    (
      neighbours.get(link.from_person) ??
      neighbours.set(link.from_person, []).get(link.from_person)!
    ).push(link.to_person);
    (
      neighbours.get(link.to_person) ?? neighbours.set(link.to_person, []).get(link.to_person)!
    ).push(link.from_person);
  }
  const order = (a: Person, b: Person) =>
    CIRCLE_ORDER.indexOf(a.circle) - CIRCLE_ORDER.indexOf(b.circle) || a.name.localeCompare(b.name);

  // Breadth-first tree from Me. People with no path hang off Me.
  const parent = new Map<string, string | null>();
  const children = new Map<string, string[]>();
  const rootId = me?.id ?? "__me__";
  parent.set(rootId, null);
  children.set(rootId, []);
  const queue = [rootId];
  const visit = () => {
    while (queue.length) {
      const id = queue.shift()!;
      const next = (neighbours.get(id) ?? [])
        .filter((other) => !parent.has(other))
        .map((other) => byId.get(other)!)
        .sort(order);
      for (const person of next) {
        if (parent.has(person.id)) continue;
        parent.set(person.id, id);
        children.set(person.id, []);
        children.get(id)!.push(person.id);
        queue.push(person.id);
      }
    }
  };
  visit();
  for (const person of [...people].sort(order)) {
    if (parent.has(person.id) || person.is_me) continue;
    parent.set(person.id, rootId);
    children.set(person.id, []);
    children.get(rootId)!.push(person.id);
    queue.push(person.id);
    visit();
  }

  const ring = new Map<string, number>([[rootId, 0]]);
  const leaves = new Map<string, number>();
  const countLeaves = (id: string): number => {
    const kids = children.get(id) ?? [];
    for (const kid of kids) {
      const person = byId.get(kid)!;
      ring.set(kid, Math.max(CIRCLE_RING[person.circle] || 1, ring.get(id)! + 1));
    }
    const total = kids.length ? kids.reduce((sum, kid) => sum + countLeaves(kid), 0) : 1;
    leaves.set(id, total);
    return total;
  };
  countLeaves(rootId);

  let rings = 0;
  const place = (id: string, start: number, end: number) => {
    const r = ring.get(id)!;
    rings = Math.max(rings, r);
    const angle = r === 0 ? 0 : (start + end) / 2;
    const person = byId.get(id);
    if (person) {
      nodes.set(id, {
        person,
        parentId: parent.get(id) ?? null,
        ring: r,
        angle,
        x: Math.round(Math.cos(angle) * r * ringGap * 10) / 10,
        y: Math.round(Math.sin(angle) * r * ringGap * 10) / 10,
      });
    }
    let cursor = start;
    const total = leaves.get(id)!;
    for (const kid of children.get(id) ?? []) {
      const share = ((end - start) * leaves.get(kid)!) / total;
      place(kid, cursor, cursor + share);
      cursor += share;
    }
  };
  place(rootId, -Math.PI / 2, (3 * Math.PI) / 2);
  return { nodes, meId: me?.id ?? null, rings };
}

/**
 * Who glows when someone is selected: them, their whole branch (their side),
 * the people they're linked to, and the path back to Me.
 */
export function litSet(
  layout: MapLayout,
  links: PersonLink[],
  selectedId: string | null,
): Set<string> | null {
  if (!selectedId || !layout.nodes.has(selectedId)) return null;
  const lit = new Set<string>([selectedId]);
  const below = new Map<string, string[]>();
  for (const node of layout.nodes.values()) {
    if (node.parentId)
      (below.get(node.parentId) ?? below.set(node.parentId, []).get(node.parentId)!).push(
        node.person.id,
      );
  }
  const stack = [selectedId];
  while (stack.length) {
    for (const kid of below.get(stack.pop()!) ?? []) {
      lit.add(kid);
      stack.push(kid);
    }
  }
  let up = layout.nodes.get(selectedId)?.parentId ?? null;
  while (up) {
    lit.add(up);
    up = layout.nodes.get(up)?.parentId ?? null;
  }
  for (const link of links) {
    if (link.from_person === selectedId) lit.add(link.to_person);
    if (link.to_person === selectedId) lit.add(link.from_person);
  }
  return lit;
}
