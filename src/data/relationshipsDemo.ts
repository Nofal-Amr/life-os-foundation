/**
 * Demo people for Relationships: a believable family with a father's side and
 * a mother's side, a few friends, dated contacts and one rule. Demo mode only.
 */
import { addDays, format, subDays } from "date-fns";

type Row = Record<string, unknown>;

const pid = (n: number) => `be0b1e00-0000-4000-8000-${String(n).padStart(12, "0")}`;

export function relationshipsSeed(now: Date, userId: string): Record<string, Row[]> {
  const ago = (days: number) => format(subDays(now, days), "yyyy-MM-dd");
  const created = subDays(now, 60).toISOString();
  const birthday = (offset: number) => {
    const date = addDays(now, offset);
    return { birthday_month: date.getMonth() + 1, birthday_day: date.getDate() };
  };
  const person = (n: number, extra: Row): Row => ({
    id: pid(n),
    user_id: userId,
    is_me: false,
    relation: "other",
    circle: "friends",
    birthday_month: null,
    birthday_day: null,
    birth_year: null,
    phone: null,
    notes: null,
    goal: null,
    checkin_every_days: null,
    checkin_since: ago(60),
    created_at: created,
    updated_at: created,
    ...extra,
  });

  const ME = 1,
    FATHER = 2,
    MOTHER = 3,
    OMAR = 4,
    LAILA = 5,
    SAMIR = 6,
    NADIA = 7,
    SARA = 8,
    YOUSSEF = 9,
    KARIM = 10,
    HASSAN = 11,
    MARIAM = 12,
    TETA = 13,
    AHMED = 14,
    TAREK = 15,
    DINA = 16;

  const people: Row[] = [
    person(ME, { is_me: true, name: "Me", relation: "me", circle: "me", checkin_since: null }),
    person(FATHER, {
      name: "Baba",
      relation: "father",
      circle: "closest",
      checkin_every_days: 3,
      birth_year: 1962,
      ...birthday(40),
      goal: "Call him every few days and take him to Friday prayer more often.",
    }),
    person(MOTHER, {
      name: "Mama",
      relation: "mother",
      circle: "closest",
      checkin_every_days: 3,
      ...birthday(95),
    }),
    person(OMAR, { name: "Omar", relation: "sibling", circle: "closest", checkin_every_days: 7 }),
    person(LAILA, {
      name: "Laila",
      relation: "sibling",
      circle: "family",
      checkin_every_days: 14,
      ...birthday(20),
    }),
    person(SAMIR, {
      name: "Uncle Samir",
      relation: "uncle_aunt",
      circle: "relatives",
      checkin_every_days: 30,
      notes: "Father's older brother. Lives in Alexandria.",
    }),
    person(NADIA, { name: "Aunt Nadia", relation: "uncle_aunt", circle: "relatives" }),
    person(SARA, { name: "Sara", relation: "cousin", circle: "relatives", ...birthday(2) }),
    person(YOUSSEF, { name: "Youssef", relation: "cousin", circle: "relatives", ...birthday(1) }),
    person(KARIM, { name: "Karim", relation: "cousin", circle: "relatives" }),
    person(HASSAN, { name: "Uncle Hassan", relation: "uncle_aunt", circle: "relatives" }),
    person(MARIAM, { name: "Mariam", relation: "cousin", circle: "relatives", ...birthday(50) }),
    person(TETA, {
      name: "Teta Fatma",
      relation: "grandparent",
      circle: "family",
      checkin_every_days: 7,
      goal: "Visit every week, even for half an hour.",
    }),
    person(AHMED, {
      name: "Ahmed",
      relation: "friend",
      circle: "friends",
      checkin_every_days: 10,
      phone: "+20 100 000 0000",
    }),
    person(TAREK, { name: "Tarek", relation: "friend", circle: "friends" }),
    person(DINA, { name: "Dina", relation: "colleague", circle: "work" }),
  ];

  let linkCount = 0;
  const link = (from: number, to: number, kind: string): Row => ({
    id: `be0b1e11-0000-4000-8000-${String(++linkCount).padStart(12, "0")}`,
    user_id: userId,
    from_person: pid(from),
    to_person: pid(to),
    kind,
    created_at: created,
  });
  const person_links = [
    link(FATHER, ME, "parent"),
    link(MOTHER, ME, "parent"),
    link(FATHER, MOTHER, "spouse"),
    link(OMAR, ME, "sibling"),
    link(LAILA, ME, "sibling"),
    link(SAMIR, FATHER, "sibling"),
    link(NADIA, FATHER, "sibling"),
    link(SARA, SAMIR, "child"),
    link(YOUSSEF, SAMIR, "child"),
    link(KARIM, NADIA, "child"),
    link(HASSAN, MOTHER, "sibling"),
    link(MARIAM, HASSAN, "child"),
    link(TETA, MOTHER, "parent"),
    link(AHMED, ME, "friend"),
    link(TAREK, AHMED, "friend"),
    link(DINA, ME, "colleague"),
  ];

  let logCount = 0;
  const log = (who: number, kind: string, daysAgo: number, note: string | null = null): Row => ({
    id: `be0b1e22-0000-4000-8000-${String(++logCount).padStart(12, "0")}`,
    user_id: userId,
    person_id: pid(who),
    kind,
    occurred_on: ago(daysAgo),
    note,
    created_at: subDays(now, daysAgo).toISOString(),
  });
  const person_interactions = [
    log(FATHER, "call", 4, "Talked about his check-up. He sounded well."),
    log(FATHER, "visit", 11, "Went to Friday prayer together."),
    log(FATHER, "note", 20, "He'd like help setting up his new phone."),
    log(MOTHER, "visit", 1),
    log(OMAR, "message", 9),
    log(LAILA, "call", 5),
    log(SAMIR, "call", 40, "Promised to visit when I'm in Alexandria."),
    log(TETA, "visit", 12, "Brought her the medicine she asked for."),
    log(AHMED, "call", 12),
    log(TAREK, "met", 25),
  ];

  const relationship_rules: Row[] = [
    {
      id: "be0b1e33-0000-4000-8000-000000000001",
      user_id: userId,
      scope_type: "relation",
      scope_value: "cousin",
      topic: "birthday",
      action: "quiet",
      except_person_ids: [pid(SARA)],
      created_at: created,
      updated_at: created,
    },
  ];

  return { people, person_links, person_interactions, relationship_rules };
}
