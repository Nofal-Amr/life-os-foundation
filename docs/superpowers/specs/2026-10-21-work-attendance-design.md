# Work: attendance and the monthly pay sheet (design)

Status: draft for Amr's approval · 21 Oct 2026

## Why

Life OS is getting a **work side**, separate from the personal app, that could later be sold as paid "pro" levels to businesses. Amr hasn't started a business yet, so the first piece is one he can prove on himself: **clocking in and out with a fingerprint at a marked place, and the monthly attendance and pay sheet that comes out of it**. He runs a test company where he is both the admin and the only staff member.

His example is the sheet his own office (ADO Consult) uses: check-in and check-out per day, late minutes, penalties, overtime, leave with or without permission, office vs site days, and the month's money (base salary, deductions, overtime pay). It is an **example of how a company might work, not fixed rules**: every rule is a setting.

## Goals

1. **A work space (organisation)** that is separate from personal data. A person's prayers, health, money and diary are never visible to the work space; the work space sees only what's inside it.
2. **Places**: the admin marks the office and sites on a map, each with a radius (default 50 m).
3. **Clock in / clock out** in the Android app: the phone's fingerprint (or its screen lock) confirms it's the phone's owner, and one location reading confirms they're at a marked place.
4. **Rules as settings**, with the example sheet as the ready-made starting point.
5. **The monthly sheet** per person, like the example: in Arabic (right to left) or English, exportable to Excel.
6. **Admin corrections** (a forgotten clock-out, a leave day) that stay visible as corrections.

## Not now (later phases)

- Invoices and expenses for clients (phase 2), shared schedules and project deadlines for a team (phase 3).
- Paid tiers, subscriptions and billing; company sign-in (SSO); iPhone.
- Paying salaries, payslips sent to staff, tax.

## Must never happen

- Location read at any time other than the moment someone clocks in or out. No tracking through the day.
- Fingerprints stored or sent anywhere. Android only answers "it's the owner"; that yes/no is all the app gets.
- An admin change that isn't visible as a change.
- Scores, rankings or "productivity" ratings of people (the plan's rule: no employee surveillance).
- Work data mixed into the personal app's numbers (XP, Today, insights), or personal data visible to an admin.

## How it works

### Setting up
- Settings → **Work** → "Make a test company" (or "Join with a code"). Making one makes you its **owner**.
- Roles: **owner** (everything, including deleting the company), **admin** (people, places, rules, corrections, everyone's sheets), **member** (clocks in and out, sees only their own sheet).
- People join with an invite code, like Together. Each member has: name, base salary, and optionally their own overtime rate.

### Places
- The admin drops a pin (map or "use where I am now"), names it, picks **office** or **site**, and sets a radius (default 50 m, 20–500 m).
- A member can clock in at any of the company's places unless the admin limits them to some.

### Clocking in and out
1. Tap **Clock in** (or **Clock out**).
2. Fingerprint prompt. If the phone has no fingerprint, its PIN or pattern works instead, and the record says which was used.
3. One fresh location reading (up to ~20 s).
4. Inside a place → saved with the time, the place, the distance and how accurate the reading was. Outside → "You're 140 m from Office", and nothing is saved.
5. GPS is often 20–40 m off indoors, so a reading counts as inside when (distance − accuracy) ≤ radius. Weak readings (accuracy worse than 100 m) are refused with "Location isn't clear here, step outside or near a window" instead of guessing.
6. **Faked location**: Android flags mock locations. Such a clock-in is saved but marked for the admin.
7. **No internet**: the event is saved on the phone with its real time and place, and sent once online (the app's offline layer already does this for other data). It's marked "sent later".
8. Clocking in only works in the Android app (fingerprint + location). The website shows records and sheets but can't clock in.

### Rules (per company, all editable; defaults from the example sheet)
| Setting | Default (from the example) |
|---|---|
| Work days | Sunday to Thursday (Friday, Saturday off) |
| Workday | 08:00 to 16:30 |
| Grace before counting late | 0 minutes |
| Late minutes | minutes after the start time |
| Penalties for very late arrival | a table the admin fills in, e.g. after 09:00 → 120 min (see question 2) |
| Overtime | minutes before the start time + minutes after the end time; a whole day worked on a day off counts entirely as overtime |
| Overtime rate | a fixed amount per hour (example: 47 EGP), or base salary ÷ the month's working hours |
| Late and penalty deduction | per hour, at the overtime rate by default |
| Leave with permission | 5% of base salary per day |
| Leave without permission | 7% of base salary per day |
| Whether absence deductions come off the total | yes (the example sheet left one out by mistake) |
| Money rounding | to the nearest pound, as in the example |
| Currency, time zone | EGP, Africa/Cairo |

- A day's **first clock-in and last clock-out** count. A clock-out after midnight belongs to the day of its clock-in.
- **Site days**: a day whose clock-in was at a place marked "site" counts as a site day. The sheet shows the count.
- **Leave**: the admin marks a day as leave with or without permission; the member can ask for it, the admin approves.
- **Holidays**: the app's holiday list (opt-in per country) marks public holidays as days off.

### Corrections
- The admin can add or change a time or mark a leave, with a reason. The original stays stored; the sheet shows corrected cells with a small mark, and a list of corrections sits under the sheet.

### The monthly sheet
- One per person per calendar month, laid out like the example: date, day, in, out, late, penalties, overtime. Weekend, leave and work-on-a-day-off rows are coloured. Then the totals: late + penalty time, overtime hours, leave days with and without permission, site days, each money line, and the total.
- Arabic (right to left) or English, following the app's language.
- **Export to Excel** (the app already exports .xlsx), one sheet per person.
- A member sees their own sheet; admins and the owner see everyone's.

## Constraints

- **Data**: Supabase with row-level security. New tables (company, members, places, rules, clock events, corrections, leaves) each tied to a company and readable only by its members according to role. Applying the migration to the live database needs Amr's OK first.
- **Android**: the fingerprint prompt is part of Android itself (`BiometricPrompt`, Android 9+), so the current no-Gradle build can use it. Location uses the same one-shot reading the Qibla uses.
- **Calculations** live in one tested module (the rules → the sheet), checked against the example sheet's numbers.
- **Separate from the personal side**: work events earn no XP and don't appear on Today, unless Amr later asks for that.
- Follows the product rules: real data only, nothing estimated, no scores of people.

## Decided by Amr
- First user: himself, as owner and only member of a test company.
- Places marked by the admin with a radius, e.g. 50 m.
- Fingerprint + location at clock-in.
- A monthly sheet like his office's example; rules are settings, not fixed.
- Later: sold as pro levels; invoices, expenses, schedules and project deadlines.

## My calls (Amr can change these)
- Location counts when (distance − accuracy) ≤ radius; readings worse than 100 m are refused.
- The phone's PIN or pattern is allowed when there's no fingerprint, and recorded as such.
- Clocking in is Android-only.
- First clock-in and last clock-out per day; after midnight belongs to the previous day.
- Absence deductions come off the total by default (one setting).
- Salaries are visible to the owner and admins, and to each member for themselves only.
- Work data stays out of XP and Today.
- **No clock-out**: the day shows "no clock-out", counts as present, and gets no overtime until the admin corrects it.
- **Leaving early** (before the end time on a work day): its own "left early" column, deducted like late minutes. It can be switched off.
- **A work day with no clock-in and no leave marked** is listed as "absent, not explained" for the admin to decide (leave with or without permission). It isn't deducted automatically.
- **Overtime minimum**: none by default (the example counts single minutes). It's a setting.
- **Where it lives**: a **Work** page in the menu once you're in a company. It shows the clock in/out button, today's record and your month; admins also get People, Places, Rules and Sheets. Settings → Work makes or joins a company.

## Questions only Amr can answer
1. **Outside the radius**: refuse (as above), or allow it with a reason that the admin sees?
2. **Penalties**: in the example, late arrivals at 9:20 and 9:59 got 120–180 penalty minutes with no single formula. Should the admin type penalties per day, or set a table ("after 09:00 → 120 min, after 09:30 → 180")?
