# Relationships: benchmark (2026-11-13)

What comparable products do for "keep in touch with the people who matter", what Life OS
learns from them, and what it avoids. Sources were retrieved on 2026-11-13. Vendor claims are
labelled as vendor claims. Facts I couldn't confirm from an official page are marked
_(third-party)_.

## The owner's ask, in short

The ask, in the owner's words:

- an Obsidian-style graph of people, with **Me** in the middle;
- family branches out to relatives;
- clicking Father makes **his side glow**, with everyone still present;
- check-ins with a chosen rhythm, a contact log, a goal per person, birthdays;
- **editable rules** such as "don't remind me of my cousin's birthday".

## What each product does

| Product | Keep-in-touch rhythm | Birthdays | Interaction log | Graph or map | Rules you can edit | Notes |
|---|---|---|---|---|---|---|
| **Monica** (open source, monicahq.com) | "Stay in touch": an alert about one person at an interval you pick | Yes, plus anniversaries; email reminders | Yes: calls, activities, gifts, debts, journal | No | Per person only | The official site says it doesn't rank relationships, recommend friends or insert ads. v3 rebuild was announced "before the end of 2026". |
| **Dex** (getdex.com) | Per-contact frequency of 1 month to 1 year (docs) | Manual or imported | Yes, with calendar and email sync | No | Per contact; caps at **5 keep-in-touch notifications a day** (docs) | Daily digest at 08:30 and a Sunday weekly digest (docs). |
| **Clay → Mesh** (App Store: "formerly known as Clay") | 2026 update: **reconnect cadences on groups** (weekly, monthly, quarterly, annual) _(third-party, What's New)_ | Requested per person or per group _(third-party)_ | Yes, via sync | No | Group-level cadence | Nexus AI assistant reads your network. |
| **Covve** (help.covve.com) | "In touch": for example every 3 months; dismissing doesn't stop the next one | Synced from the address book | Light | No | Per contact | Lists missed reminders, which you act on, reschedule or dismiss. |
| **UpHabit** (uphabit.com) | Pre-set or custom intervals; snooze | Custom reminders for birthdays and milestones | Conversation notes | No | Per contact | Now aimed at businesses and teams. |
| **Nat** (nat.app) _(third-party)_ | Finds people you've "been out of sync with" from Gmail and Calendar | Not confirmed | From email metadata | No | No | Reads your inbox metadata; no free plan. |
| **Obsidian graph view** (obsidian.md/help) | n/a | n/a | n/a | Force graph; hovering a node **lights up its links**; local graph with a depth setting | Filters and groups | A community plugin (Intuitive Graph Navigation) adds a **click to lock** highlight, because hover-only highlighting is fragile. |
| **FamilySearch** (familysearch.org help) | n/a | Records only | n/a | Fan chart up to 7 generations; landscape and portrait views with the person in the centre | n/a | No landscape view on mobile. |
| **Kinship diagrams** (Lucid template guide; RelaTree on the App Store) | n/a | RelaTree stores birthdays | n/a | **Ego-centred**: everyone labelled by their relation to "Ego" | n/a | Lucid advises tagging each shape with its relation to Ego once the chart gets crowded. |

Sources:

- Monica: [monicahq.com](https://monicahq.com/), [new-feature blog](https://monicahq.com/blog/category/new-feature?page=2).
- Dex: [Stay Informed docs](https://getdex.com/docs/workflows/stay-informed), [Dex core](https://guidev3.getdex.com/dex-core), [Dex vs Monica, 2026-07-07](https://getdex.com/blog/dex-vs-monica/) (a competitor's page).
- Mesh/Clay: [App Store](https://apps.apple.com/us/app/mesh-contacts-crm/id1463073824), [What's New](https://library.me.sh/hc/en-us/sections/6655291907995-What-s-New).
- Covve: [help: In touch](https://help.covve.com/doc/in-touch-stay-in-touch-with-your-most-important-contacts-and-keep-them-warm-for-when-you-need-them-most).
- UpHabit: [uphabit.com](https://uphabit.com/), [App Store](https://apps.apple.com/us/app/id1335632832).
- Nat: [Product Hunt](https://www.producthunt.com/p/nat-ai/nat).
- Obsidian: [Graph view help](https://obsidian.md/help/plugins/graph), [Intuitive Graph Navigation](https://community.obsidian.md/plugins/intuitive-graph-navigation).
- FamilySearch: [tree views](https://www.familysearch.org/en/blog/family-tree-views), [fan chart help](https://www.familysearch.org/help/helpcenter/article/how-do-i-use-the-fan-chart-view-in-family-tree).
- Kinship: [Lucid kinship guide](https://app.lucid.co/diagram/family-tree/make-a-kinship-diagram-online).

## What nobody combines

- The personal CRMs (Monica, Dex, Mesh, Covve, UpHabit, Nat) are **lists with timers**. None
  shows people as a map of how they connect to you.
- The graph and tree tools (Obsidian, FamilySearch, kinship diagrams) are **maps with no
  rhythm**: no check-ins and no reminders.
- No product found lets you write **rules with exceptions in plain words** ("no cousin
  birthdays, except Sara"). Mesh comes closest with group cadences.

Life OS can be the calm one in the middle: a map of *your* people, and one quiet line in Today
when it's been a while.

## What to learn (adapted, not copied)

1. **A rhythm per person: Monica, Covve, UpHabit.** In Life OS this is "check in every 3 days /
   2 weeks / month", chosen in words, with no score.
2. **Group-level defaults: Mesh.** Life OS rules apply to a circle ("family") or a relation
   ("cousins"), and a person-level rule beats a group rule.
3. **A daily cap: Dex.** Today shows at most **3** check-ins, oldest first. A long list feels
   like debt, which the ADHD-first rule forbids.
4. **A dismissal is not a failure: Covve.** "Not now" quietly moves the check-in to tomorrow.
   Nothing is ever marked "missed".
5. **Click to lock the highlight: the Obsidian plugin.** Selecting a person keeps their side lit
   until you tap empty space or press Escape, so it works on a phone, where there is no hover.
6. **The person in the centre: FamilySearch and kinship diagrams.** Me sits in the middle and
   everyone is labelled by their relation to me ("Father", "Cousin").
7. **No ranking: Monica's stated principle.** Life OS has no relationship score, no health
   bar and no "strength" percentage. Progress is the dated log and your own notes.

## What to avoid

- **Reading inboxes and calendars to infer closeness (Nat, Dex sync).** It breaks the
  on-device, real-data rule and turns a guess into a judgement. Only contacts the user logs count.
- **Physics that keeps moving (default Obsidian).** A drifting graph is hard to tap on a phone,
  and people move every time you open it. Life OS uses a **calm, fixed layout**: rings that
  are the same every time.
- **Pop-ups on select.** The owner said "glow, not pop up". The person sheet opens only when
  you ask for details.
- **AI assistants and paywalls (Mesh, Nat).** Neither is needed for a core that is a list and a
  map.
- **Overdue counters and red badges.** Wording is always "last call 12 days ago", never
  "overdue" or "neglected".

## Decisions for Life OS

- A home-made SVG graph with a deterministic radial layout, so it adds **no new dependency**.
  `react-force-graph` with three.js weighs hundreds of kB, and `d3-force` adds about 30 kB and
  makes the layout move. Rings and angular sectors give each family branch its own wedge, so
  "father's side" is a real place on screen.
- A list view of the same data with the same select-to-glow, for screen readers and small
  screens.
- Rules are typed: scope (everyone, circle, relation or person), topic (birthdays, check-ins
  or both), action (remind or stay quiet), and exceptions. They read back as one sentence.
