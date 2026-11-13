/**
 * Reading and saving Relationships rows. The tables come from
 * supabase/migrations/20261113120000_relationships.sql; until that is applied
 * a database answers "table not found", which `isMissingTable` recognises so
 * the page can say so calmly instead of failing.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

import type { Interaction, InteractionKind, Person, PersonLink, Rule } from "./relationships";

// The generated types don't have these tables until the migration is applied.
const table = (name: string) => supabase.from(name as never);

export const relationshipKeys = {
  all: ["relationships"] as const,
  people: ["relationships", "people"] as const,
  links: ["relationships", "links"] as const,
  interactions: ["relationships", "interactions"] as const,
  rules: ["relationships", "rules"] as const,
};

export function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "PGRST205" || code === "42P01";
}

const list = async <T>(name: string, order: string, ascending = true) =>
  unwrap(await table(name).select("*").order(order, { ascending })) as unknown as T[];

export const peopleQuery = () =>
  queryOptions({
    queryKey: relationshipKeys.people,
    queryFn: () => list<Person>("people", "name"),
    retry: (count, error) => !isMissingTable(error) && count < 2,
  });
export const linksQuery = () =>
  queryOptions({
    queryKey: relationshipKeys.links,
    queryFn: () => list<PersonLink>("person_links", "created_at"),
    retry: (count, error) => !isMissingTable(error) && count < 2,
  });
export const interactionsQuery = () =>
  queryOptions({
    queryKey: relationshipKeys.interactions,
    queryFn: () => list<Interaction>("person_interactions", "occurred_on", false),
    retry: (count, error) => !isMissingTable(error) && count < 2,
  });
export const rulesQuery = () =>
  queryOptions({
    queryKey: relationshipKeys.rules,
    queryFn: () => list<Rule>("relationship_rules", "created_at"),
    retry: (count, error) => !isMissingTable(error) && count < 2,
  });

export type PersonInput = Omit<Person, "id" | "user_id" | "created_at" | "is_me"> & {
  is_me?: boolean;
};

export async function createPerson(input: PersonInput): Promise<Person> {
  const user_id = await currentUserId();
  return unwrap(
    await table("people")
      .insert({ ...input, user_id } as never)
      .select()
      .single(),
  ) as unknown as Person;
}

export async function updatePerson(id: string, input: Partial<PersonInput>): Promise<Person> {
  return unwrap(
    await table("people")
      .update(input as never)
      .eq("id", id)
      .select()
      .single(),
  ) as unknown as Person;
}

export async function deletePerson(id: string): Promise<void> {
  // Links and interactions go with the person (ON DELETE CASCADE in the
  // database; done by hand here so the demo matches).
  // Two plain filters, not or=: the offline and demo layers can't evaluate or=.
  unwrap(await table("person_links").delete().eq("from_person", id).select());
  unwrap(await table("person_links").delete().eq("to_person", id).select());
  unwrap(await table("person_interactions").delete().eq("person_id", id).select());
  unwrap(await table("people").delete().eq("id", id).select());
}

/** Me is created the first time it's needed, so the map always has a centre. */
export async function ensureMe(people: Person[], name = "Me"): Promise<Person> {
  const existing = people.find((person) => person.is_me);
  if (existing) return existing;
  return createPerson({
    is_me: true,
    name,
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
  });
}

export async function createLink(input: Omit<PersonLink, "id">): Promise<PersonLink> {
  const user_id = await currentUserId();
  return unwrap(
    await table("person_links")
      .insert({ ...input, user_id } as never)
      .select()
      .single(),
  ) as unknown as PersonLink;
}

export async function deleteLink(id: string): Promise<void> {
  unwrap(await table("person_links").delete().eq("id", id).select());
}

export async function logInteraction(input: {
  person_id: string;
  kind: InteractionKind;
  occurred_on: string;
  note?: string | null;
}): Promise<Interaction> {
  const user_id = await currentUserId();
  return unwrap(
    await table("person_interactions")
      .insert({ note: null, ...input, user_id } as never)
      .select()
      .single(),
  ) as unknown as Interaction;
}

export async function deleteInteraction(id: string): Promise<void> {
  unwrap(await table("person_interactions").delete().eq("id", id).select());
}

export type RuleInput = Omit<Rule, "id" | "created_at">;

export async function createRule(input: RuleInput): Promise<Rule> {
  const user_id = await currentUserId();
  return unwrap(
    await table("relationship_rules")
      .insert({ ...input, user_id } as never)
      .select()
      .single(),
  ) as unknown as Rule;
}

export async function updateRule(id: string, input: Partial<RuleInput>): Promise<Rule> {
  return unwrap(
    await table("relationship_rules")
      .update(input as never)
      .eq("id", id)
      .select()
      .single(),
  ) as unknown as Rule;
}

export async function deleteRule(id: string): Promise<void> {
  unwrap(await table("relationship_rules").delete().eq("id", id).select());
}

/* "Not now" in Today: moves an item to tomorrow, on this device only. */
const SNOOZE_KEY = "lifeos:people-snooze";

function readSnoozes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function isNudgeSnoozed(key: string, today: string): boolean {
  return readSnoozes()[key] === today;
}

export function snoozeNudge(key: string, today: string): void {
  try {
    const next = Object.fromEntries(
      Object.entries(readSnoozes()).filter(([, day]) => day === today),
    );
    next[key] = today;
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(next));
  } catch {
    // Without storage it simply shows again.
  }
}
