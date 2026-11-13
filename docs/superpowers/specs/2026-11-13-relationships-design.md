# Relationships: design (2026-11-13)

Research: `docs/research/2026-11-13-relationships-benchmark.md`.

## What it is

Relationships is a ninth area at `/relationships`. It opens on a map of the
people in your life:

- **Me** in the centre;
- closest people on the first ring, family on the second and relatives further out;
- every person always drawn.

Tapping someone (Father, for example) makes **their side glow** and dims the rest, but
nothing disappears and nothing pops up. A separate "Details" button opens the person sheet.

## Principles (Life OS rules applied)

- **Real data only.** "Last contact" is the newest interaction the user logged. There is no
  closeness score, health bar or percentage.
- **Calm wording.** Use "Check in with Ahmed · last call 12 days ago". Never use "overdue",
  "neglected" or "you missed". "Not now" moves an item to tomorrow and nothing is counted.
- **Never a pile.** Today shows at most **3** check-ins (oldest contact first) and any
  birthdays within the next 3 days.
- **Opt-in area.** It is off until the user turns on **Relationships** in Settings → Areas (it is on in
  the demo). This also means no request reaches a database that doesn't have the tables yet.

## The map

The layout is deterministic: no physics, the same every time, and easy to tap on a phone.

1. Build a tree outward from Me with a breadth-first search over the links. A person with no
   link to anyone hangs off Me.
2. **Ring** = the circle's base ring (closest 1, family 2, friends 2, relatives 3, work 3), and
   always at least one ring further out than the person they hang from. So Father (closest) →
   Uncle (relative, ring 3) → Cousin (ring 4).
3. **Angle**: Me owns the full circle. Each child gets a wedge of its parent's wedge in
   proportion to the number of leaves below it. So Father's side is one wedge and Mother's side
   is another.
4. **Lines** are the stored links, labelled by kind: parent, child, sibling, spouse, cousin,
   friend, colleague or other. They are tinted per kind, and each also carries its text label.

**Selecting a person** lights up:

- the person;
- everyone on their branch (their side);
- their direct links;
- the path back to Me.

The rest drops to about 25% opacity, with a 200 ms opacity transition. Tap empty space or press
Escape to clear. The selection stays until cleared (as in Obsidian's click-lock plugin), so it
works with touch.

**Pan and zoom:**

- drag to pan;
- the wheel or a pinch to zoom;
- buttons for zoom in, zoom out and fit, for keyboard and accessibility.

The SVG has `touch-action: none`.

**List view.** A Map / List switch. The list shows the same people grouped by circle, with the
same select-to-glow, and each row is a real button. This is the accessible alternative.

## The person sheet

The sheet holds:

- name, relation to me ("Father", "Cousin") and circle;
- birthday (day and month, year optional) and phone;
- notes;
- **check-in rhythm**: none, every 3 days, every week, every 2 weeks, every month or every 3
  months;
- **goal**: free text, for example "Visit once a month and help with the garden";
- **log**: one tap each for Called, Messaged, Visited and Met, plus a note. It is shown as a
  dated list, and that list *is* the progress;
- **links**: the people this person is connected to, with the kind of link.

## Rules

Each rule reads back as one sentence: *"Don't remind me of birthdays for cousins, except
Sara."*

| Part | Options |
|---|---|
| Applies to | everyone · a circle (closest, family, relatives, friends, work) · a relation (father, cousin…) · one person |
| What | birthdays · check-ins · both |
| Does | remind me · stay quiet |
| Except | any number of people |

**Evaluation**, for one person and one topic:

1. Take the rules whose topic matches and whose scope includes the person, leaving out rules
   that list the person as an exception.
2. The most specific rule wins: person, then relation, then circle, then everyone. On a tie,
   the newest rule wins.
3. With no rule, **remind** is the default.

A birthday item fires when allowed and the birthday falls within 0–3 days. A check-in item
fires when allowed, a rhythm is set, and the days since the last contact (or since the rhythm
was set, if nothing is logged) are at least the rhythm. 29 February birthdays fall on
28 February in non-leap years.

## Today

A small "People" card in Today (under the Log tiles) lists the items that fire. Each item has:

- **Logged a call**: adds an interaction today, and the item goes away.
- **Make a task**: "Call Ahmed" or "Congratulate Ahmed", due today.
- **Not now**: moves it to tomorrow, on this device only.

## Data (migration `20261113120000_relationships.sql`, waiting for approval)

Every table has `user_id` and RLS that limits each user to their own rows. Links and
interactions can only point at people the user owns.

- `people`: `is_me`, `name`, `relation`, `circle`, `birthday_month`, `birthday_day`,
  `birth_year`, `phone`, `notes`, `goal`, `checkin_every_days`, `checkin_since`.
- `person_links`: `from_person`, `to_person`, `kind`. It means "from is <kind> of to".
- `person_interactions`: `person_id`, `kind` (call, message, visit, met, note), `occurred_on`,
  `note`.
- `relationship_rules`: `scope_type`, `scope_value`, `topic`, `action`, `except_person_ids`.

The existing "Together" tables are shared spaces with other accounts, not a contact list, so
they aren't reused.

## Out of scope for now

- Importing phone contacts.
- Native notifications for check-ins.
- Shared family trees.
- Kinship inference ("your father's brother is your uncle"). Relation labels are chosen by hand.
