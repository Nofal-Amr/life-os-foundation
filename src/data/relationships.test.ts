import { describe, expect, it } from "vitest";

import {
  checkInState,
  decidingRule,
  describeRule,
  layoutMap,
  litSet,
  nextBirthday,
  todaysNudges,
  turningAge,
  wantsReminder,
  type Interaction,
  type Person,
  type PersonLink,
  type Rule,
} from "./relationships";

const person = (id: string, extra: Partial<Person> = {}): Person => ({
  id,
  is_me: false,
  name: id,
  relation: "friend",
  circle: "friends",
  birthday_month: null,
  birthday_day: null,
  birth_year: null,
  phone: null,
  notes: null,
  goal: null,
  checkin_every_days: null,
  checkin_since: null,
  created_at: "2026-10-01T10:00:00Z",
  ...extra,
});
const rule = (extra: Partial<Rule>): Rule => ({
  id: Math.random().toString(16),
  scope_type: "everyone",
  scope_value: null,
  topic: "both",
  action: "remind",
  except_person_ids: [],
  created_at: "2026-11-01T00:00:00Z",
  ...extra,
});
const call = (
  person_id: string,
  occurred_on: string,
  kind: Interaction["kind"] = "call",
): Interaction => ({
  id: `${person_id}-${occurred_on}`,
  person_id,
  kind,
  occurred_on,
  note: null,
});

const sara = person("sara", {
  name: "Sara",
  relation: "cousin",
  circle: "relatives",
  birthday_month: 11,
  birthday_day: 14,
});
const mona = person("mona", {
  name: "Mona",
  relation: "cousin",
  circle: "relatives",
  birthday_month: 11,
  birthday_day: 15,
});
const ahmed = person("ahmed", {
  name: "Ahmed",
  relation: "father",
  circle: "closest",
  checkin_every_days: 3,
});

describe("reminder rules", () => {
  const noCousinBirthdays = rule({
    scope_type: "relation",
    scope_value: "cousin",
    topic: "birthday",
    action: "quiet",
    except_person_ids: ["sara"],
  });

  it("reminds by default when no rule applies", () => {
    expect(wantsReminder([], mona, "birthday")).toBe(true);
    expect(decidingRule([], mona, "birthday")).toBeNull();
  });

  it("keeps cousins' birthdays quiet, except the person named", () => {
    expect(wantsReminder([noCousinBirthdays], mona, "birthday")).toBe(false);
    expect(wantsReminder([noCousinBirthdays], sara, "birthday")).toBe(true);
  });

  it("only touches the topic it names", () => {
    expect(wantsReminder([noCousinBirthdays], { ...mona, checkin_every_days: 7 }, "checkin")).toBe(
      true,
    );
  });

  it("lets the most specific rule win: a person rule beats a relation rule", () => {
    const monaOn = rule({
      scope_type: "person",
      scope_value: "mona",
      topic: "birthday",
      action: "remind",
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(wantsReminder([noCousinBirthdays, monaOn], mona, "birthday")).toBe(true);
  });

  it("a relation rule beats a circle rule, and a circle rule beats everyone", () => {
    const quietRelatives = rule({
      scope_type: "circle",
      scope_value: "relatives",
      action: "quiet",
    });
    const remindCousins = rule({ scope_type: "relation", scope_value: "cousin", action: "remind" });
    const quietAll = rule({ action: "quiet" });
    expect(wantsReminder([quietAll], ahmed, "checkin")).toBe(false);
    expect(wantsReminder([quietAll, quietRelatives, remindCousins], mona, "birthday")).toBe(true);
    expect(wantsReminder([quietRelatives], mona, "birthday")).toBe(false);
  });

  it("the newest rule wins a tie at the same level", () => {
    const older = rule({
      scope_type: "circle",
      scope_value: "relatives",
      action: "quiet",
      created_at: "2026-01-01T00:00:00Z",
    });
    const newer = rule({
      scope_type: "circle",
      scope_value: "relatives",
      action: "remind",
      created_at: "2026-06-01T00:00:00Z",
    });
    expect(wantsReminder([older, newer], mona, "birthday")).toBe(true);
    expect(wantsReminder([newer, older], mona, "birthday")).toBe(true);
  });

  it("an exception falls back to the next rule down, not to remind", () => {
    const quietAll = rule({ action: "quiet" });
    expect(wantsReminder([quietAll, noCousinBirthdays], sara, "birthday")).toBe(false);
  });

  it("reads back as one plain sentence", () => {
    expect(describeRule(noCousinBirthdays, [sara, mona])).toBe(
      "Don't remind me of birthdays for cousins, except Sara.",
    );
    expect(
      describeRule(rule({ scope_type: "person", scope_value: "ahmed", topic: "checkin" }), [ahmed]),
    ).toBe("Remind me of check-ins for Ahmed.");
  });
});

describe("birthdays", () => {
  it("finds the next birthday this year or next", () => {
    expect(nextBirthday(sara, "2026-11-13")).toBe("2026-11-14");
    expect(nextBirthday(sara, "2026-11-14")).toBe("2026-11-14");
    expect(nextBirthday(sara, "2026-11-15")).toBe("2027-11-14");
    expect(nextBirthday(person("x"), "2026-11-13")).toBeNull();
  });

  it("puts 29 February on the 28th in other years", () => {
    const leap = person("leap", { birthday_month: 2, birthday_day: 29 });
    expect(nextBirthday(leap, "2026-11-13")).toBe("2027-02-28");
    expect(nextBirthday(leap, "2027-03-01")).toBe("2028-02-29");
  });

  it("says the age only when the year is known", () => {
    expect(turningAge({ ...sara, birth_year: 2000 }, "2026-11-13")).toBe(26);
    expect(turningAge(sara, "2026-11-13")).toBeNull();
  });
});

describe("check-in rhythm", () => {
  it("counts from the last logged contact and ignores plain notes", () => {
    const state = checkInState(
      ahmed,
      [call("ahmed", "2026-11-01"), call("ahmed", "2026-11-12", "note")],
      "2026-11-13",
    );
    expect(state).toMatchObject({ daysSince: 12, nextOn: "2026-11-04", due: true });
  });

  it("is not due until the rhythm comes round", () => {
    expect(checkInState(ahmed, [call("ahmed", "2026-11-11")], "2026-11-13")?.due).toBe(false);
    expect(checkInState(ahmed, [call("ahmed", "2026-11-10")], "2026-11-13")?.due).toBe(true);
  });

  it("counts from when the rhythm was set if nothing is logged", () => {
    const state = checkInState({ ...ahmed, checkin_since: "2026-11-12" }, [], "2026-11-13");
    expect(state).toMatchObject({ daysSince: 1, due: false, last: null });
  });

  it("has no state without a rhythm", () => {
    expect(checkInState(sara, [], "2026-11-13")).toBeNull();
  });
});

describe("today's nudges", () => {
  const friends = Array.from({ length: 5 }, (_, index) =>
    person(`f${index}`, { name: `Friend ${index}`, checkin_every_days: 7 }),
  );
  const log = friends.map((friend, index) =>
    call(friend.id, `2026-10-${String(10 + index).padStart(2, "0")}`),
  );

  it("shows birthdays within three days and at most three check-ins, longest first", () => {
    const nudges = todaysNudges({
      people: [sara, ...friends],
      interactions: log,
      rules: [],
      today: "2026-11-13",
    });
    expect(nudges[0]).toMatchObject({
      kind: "birthday",
      title: "Sara's birthday",
      detail: "Tomorrow",
    });
    const checkins = nudges.filter((nudge) => nudge.kind === "checkin");
    expect(checkins.map((nudge) => nudge.person.id)).toEqual(["f0", "f1", "f2"]);
    expect(checkins[0]!.detail).toBe("Last call 34 days ago");
  });

  it("follows the rules and leaves snoozed items out", () => {
    const rules = [
      rule({ scope_type: "relation", scope_value: "cousin", topic: "birthday", action: "quiet" }),
    ];
    expect(
      todaysNudges({ people: [sara, mona], interactions: [], rules, today: "2026-11-13" }),
    ).toEqual([]);
    const snoozed = (key: string) => key.startsWith("checkin-f0");
    const ids = todaysNudges({
      people: friends,
      interactions: log,
      rules: [],
      today: "2026-11-13",
      snoozed,
    }).map((nudge) => nudge.person.id);
    expect(ids).toEqual(["f1", "f2", "f3"]);
  });

  it("never nudges about Me", () => {
    const me = person("me", {
      is_me: true,
      circle: "me",
      relation: "me",
      checkin_every_days: 1,
      birthday_month: 11,
      birthday_day: 13,
    });
    expect(
      todaysNudges({ people: [me], interactions: [], rules: [], today: "2026-11-13" }),
    ).toEqual([]);
  });
});

describe("the map", () => {
  const me = person("me", { is_me: true, name: "Me", circle: "me", relation: "me" });
  const father = person("father", { relation: "father", circle: "closest" });
  const mother = person("mother", { relation: "mother", circle: "closest" });
  const uncle = person("uncle", { relation: "uncle_aunt", circle: "relatives" });
  const cousin = person("cousin", { relation: "cousin", circle: "relatives" });
  const aunt = person("aunt", { relation: "uncle_aunt", circle: "relatives" });
  const loner = person("loner");
  const link = (from: string, to: string, kind: PersonLink["kind"]): PersonLink => ({
    id: `${from}-${to}`,
    from_person: from,
    to_person: to,
    kind,
  });
  const links = [
    link("father", "me", "parent"),
    link("mother", "me", "parent"),
    link("uncle", "father", "sibling"),
    link("cousin", "uncle", "child"),
    link("aunt", "mother", "sibling"),
  ];
  const layout = layoutMap([me, father, mother, uncle, cousin, aunt, loner], links, 100);

  it("puts Me in the centre and everyone else on a ring", () => {
    expect(layout.nodes.get("me")).toMatchObject({ ring: 0, x: 0, y: 0 });
    expect(layout.nodes.get("father")!.ring).toBe(1);
    expect(layout.nodes.get("uncle")!.ring).toBe(3);
    expect(layout.nodes.get("cousin")!.ring).toBe(4);
    expect(layout.nodes.size).toBe(7);
  });

  it("hangs relatives from the person they connect through, and unlinked people from Me", () => {
    expect(layout.nodes.get("uncle")!.parentId).toBe("father");
    expect(layout.nodes.get("cousin")!.parentId).toBe("uncle");
    expect(layout.nodes.get("loner")!.parentId).toBe("me");
  });

  it("keeps each side in its own wedge", () => {
    const angle = (id: string) => layout.nodes.get(id)!.angle;
    expect(Math.abs(angle("uncle") - angle("father"))).toBeLessThan(
      Math.abs(angle("uncle") - angle("mother")),
    );
    expect(Math.abs(angle("aunt") - angle("mother"))).toBeLessThan(
      Math.abs(angle("aunt") - angle("father")),
    );
  });

  it("is the same every time", () => {
    expect(
      [...layoutMap([loner, cousin, aunt, me, uncle, mother, father], links, 100).nodes.values()]
        .map((n) => [n.person.id, n.x, n.y])
        .sort(),
    ).toEqual([...layout.nodes.values()].map((n) => [n.person.id, n.x, n.y]).sort());
  });

  it("lights Father's side and the way back to Me, and nobody on Mother's side", () => {
    const lit = litSet(layout, links, "father")!;
    expect([...lit].sort()).toEqual(["cousin", "father", "me", "uncle"]);
    expect(litSet(layout, links, null)).toBeNull();
  });
});
