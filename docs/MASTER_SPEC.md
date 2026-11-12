> **Status of this document.** Product target and reference only. Its sections were written at different times: phase numbers collide, section 2 predates the Phase 0 audit, and existing modules (Work, Together, Study, Finance, Resources, Life Connect) are not yet covered.
> **Precedence:** per-phase execution prompts define scope and win any conflict with this document. If they conflict, ask the owner.
> **Third-party and platform claims** (passkey APIs, Play Console rules, Vercel terms, payment-provider country support) are unverified until checked.

# Life OS — Master Build Spec

## 0. Your role and how to work
You are the lead engineer and product designer for Life OS. Work in phases, in order.
- Start every phase by inspecting the relevant code and schema. Do not assume; confirm the stack, folder structure and existing patterns from the repo.
- Before any database migration, destructive change or large refactor: explain the plan, list risks, and wait for my approval.
- Never break existing user data. All migrations must be reversible and tested on a staging Supabase project first.
- Write tests alongside features. A feature without tests is not done.
- Small, focused commits with clear messages. One feature per branch/PR.
- When requirements are ambiguous, ask one precise question instead of guessing.
- At the end of each phase, give me: what was built, what was tested, known issues, and what's next.

## 1. Product vision
Life OS is a pro-level life-management platform. Its core purpose: take yearly and longer-term goals and break them into realistic daily actions that add up, so that by the end of the period the user has achieved what they set out to do, while the app actively keeps goals realistic and prevents overplanning.

Goal types: purchases, relationships, courses, work, self-upgrades, health, spiritual.
Audience: individuals first (mass adoption), then families, colleges and enterprises.
Design target: mature, calm, fast, pro-grade UX on par with Linear, Things 3 and Hevy.

## 2. Current state (verify against the repo)
- Repo: github.com/Nofal-Amr/life-os-foundation
- Web frontend: self-hosted, live on `main` (confirm framework, likely React + Vite + TypeScript + Tailwind + shadcn/ui)
- Backend: own Supabase project "life-os-foundation" (migrated off Lovable Cloud; schema, auth and data restored)
- Auth: Google sign-in (Apple removed)
- Native Android app syncing via the same Supabase account (confirm language/toolkit)
- Offline mode with a sync queue
- Week/cadence screen built but not live, pending a real-data check
- Planned: life-dimension indices based on Maslow's hierarchy, Health module, Spirit module, Serious/RPG skins

## 3. Phase 0 — Audit (no code changes)
Produce a written audit report covering:
1. Architecture map: web, Android, Supabase, data flow, sync queue.
2. Security: every table's RLS policies; any path where one user could read or write another user's data; auth edge cases on web and Android; exposed keys.
3. Schema review: can it support everything in this spec without painful migrations? Propose the target schema.
4. Offline sync: races, duplicate writes, conflict handling between devices, failure recovery.
5. Web vs Android consistency: logic, data handling and UX mismatches.
6. Code quality, test coverage, performance hotspots.
Deliver a prioritized fix list (critical / high / medium / low).

## 4. Phase 1 — Foundation
- Fix all critical and high audit findings.
- Multi-tenant-ready schema: `organizations`, `memberships`, roles; every user-owned row has `user_id` and optional `org_id`. RLS enforces it.
- Robust sync: idempotent writes (client-generated IDs), per-record versioning, a defined conflict policy, retry with backoff, tests for multi-device edits.
- Test setup: unit, integration (against a local/staging Supabase) and end-to-end for core flows.
- CI on GitHub: lint, typecheck, tests on every PR.
- Error monitoring and structured logging on web and Android.
- Staging environment separate from production.

## 5. Phase 2 — Design system and UX foundation
Principles: calm by default, one primary action per screen, progressive disclosure, speed as a feature (<100 ms response), undo instead of confirm dialogs, density only where it earns it.

Build:
- Design tokens: semantic colors, 4/8 pt spacing, type scale, radius, elevation, motion durations and easing.
- Dark mode as a first-class theme.
- Typography: Inter + IBM Plex Sans Arabic; tabular numerals for weights, times and money.
- Full RTL support from day one using logical CSS properties; Arabic and English.
- Skins: Serious and RPG as token sets over the same components.
- One icon set (Lucide), one illustration style.
- Component library with Storybook; visual regression tests.
- Motion: 150–250 ms transitions, spring easing, shared-element transitions; respect reduce-motion.
- States: skeleton loaders, teaching empty states, actionable error messages, quiet offline indicator.
- Accessibility: 4.5:1 contrast, 48 dp touch targets, screen-reader labels, full keyboard support.

Interactions:
- Web: command palette (Ctrl/Cmd+K), keyboard shortcuts with a `?` cheat sheet, drag-to-reschedule, natural-language quick add ("call mom every Friday 8pm", "gym Mon Wed Sat").
- Android: swipe to complete/snooze, long-press quick actions, haptics on meaningful moments, home-screen widgets (Today, next prayer, Poco battery, start workout), Quick Settings tile, Android 16 Live Updates for timers and active calls.
- Both: optimistic UI on every write.

Flagship: redesign the Today screen end to end first; it becomes the reference for every other screen.

## 6. Phase 3 — Core goal engine
- Hierarchy: goal → quarter → month → week → daily action. Goals can be yearly or multi-year.
- Templates per goal type:
  - Purchase → savings schedule and milestones
  - Relationship → contact cadence
  - Course → lessons per week
  - Health → sessions per week
  - Work/self-upgrade → milestones and recurring practice
- Effort estimate for every goal and action.
- Capacity budget: user-defined available time/energy per day; the engine refuses or warns when commitments exceed capacity.
- Realism check: learn the user's actual completion rate and show it honestly ("you complete ~60% of planned items"); adjust future plans accordingly.
- Built-in buffer on every plan.
- Rebalancing: missed work is re-spread across remaining time, not piled up. Each goal shows a status: on track / at risk / not realistic, with a suggested fix.
- Progress views: per goal, per life dimension (Maslow-based indices), per year.

## 7. Phase 4 — Focus and ADHD-friendly guardrails
Designed for users with inattentive ADHD and overplanning tendencies:
- Hard daily cap of about 3 "must do" items; everything else is optional.
- Overplanning warnings ("this week is 140% of your capacity").
- Minimum-viable-day mode for low-energy days.
- Very low-friction capture from anywhere.
- No punishing streaks; reward consistency gently.
- Eisenhower Matrix for daily tasks, with automatic protected time for important-not-urgent work (where long-term goals live).

## 8. Phase 5 — Health & Gym
Learn from Strong, Hevy, Fitbod, MacroFactor, MyFitnessPal and Mealime.

Workout logging:
- Exercise library with instructions and target muscles.
- Sets, reps, weight, RPE; each set pre-filled from last time.
- Rest timer on the lock screen (Live Update), supersets, warm-up sets, plate calculator.
- PR detection, per-exercise history charts, saved templates.
- Fully offline logging.

Progression:
- Progressive-overload suggestions, weekly volume per muscle group, recovery map, deload weeks.

Plans and scheduling:
- Program templates: full body 3x, upper/lower, push/pull/legs, beginner plans.
- Plan adapts to the days the user can actually train; missed sessions are rebalanced.
- Sessions placed as protected blocks around work and prayer times, including travel time and gym opening hours.
- Reminders; optional geofenced gym check-in; gym-bag reminder the night before.
- One-tap "start next workout"; a minimum-session option (20 minutes counts).

Nutrition and meal prep:
- Food log with barcode scanning, saved meals, macros.
- Local Egyptian food database (ful, ta'meya, koshari, etc.).
- Weekly meal-prep planner → auto-generated scaled shopping list → scheduled prep session.

Body and health data:
- Smoothed weight trend, measurements, private progress photos.
- Android Health Connect sync (steps, sleep, heart rate; Samsung Health feeds into it).

Ramadan mode: workout timing around iftar, suhoor meal planning, lighter training during fasting.

Safety: pain or injury inputs direct the user to a doctor or physiotherapist; the app coaches training, not medical issues.

## 9. Phase 6 — Family and relationships
- People as first-class entities: relationship type, target cadence, notes.
- Cadence goals (e.g. call mom weekly, relatives monthly, date night every two weeks, one-on-one time with each child weekly, family outing monthly).
- "Time since last contact" with overdue people surfaced gently.
- One-tap call/interaction logging with optional notes.
- Date-night planner: idea list, restaurant wishlist, booking reminders, "plan it for me".
- Kids' activity bank tagged by child, age, cost, duration, indoor/outdoor; "pick one for Saturday"; per-child milestones and memory log.
- Important dates: birthdays, anniversaries, school events, with early reminders.
- Optional post-activity reflection ("how did it feel?").
- Warm tone: "It's been a while since you spoke with Dad", never "Task overdue".
- Shared family calendar (later phase).
- Tables: `people`, `relationship_cadences`, `interactions`, `activity_ideas`, `important_dates`, all linked to `goals` and `tasks`.
- Family and children's data is private by default with strict RLS.

## 10. Phase 7 — Spirit
- Accurate prayer-time calculation by location, with selectable calculation method.
- Prayer alarms with reliable exact-alarm scheduling.
- Prayer-aware scheduling across all modules.
- Automation: silence phones at prayer time and restore afterwards.

## 11. Phase 8 — Device sync (Poco ↔ S25 Ultra)
Architecture:
- Device agent: foreground service on the controlled phone (Poco, HyperOS).
- Command and state protocol: FCM high-priority data messages for delivery; Supabase tables for state, commands and acknowledgements.
- Dashboard on the controlling phone (S25 Ultra).

Status sync:
- Battery %, charging state, temperature, estimated time left, ringer mode, all volume streams, network/Wi-Fi, signal, last seen.

Alerts:
- Low battery at user-set thresholds, charging complete, device offline.

Call mirroring (fix the current bug):
- On the Poco, listen with TelephonyCallback for RINGING, OFFHOOK and IDLE; send each event with a `call_id`.
- On the S25, show a CallStyle notification using `call_id` as the notification ID.
- On OFFHOOK or IDLE, cancel the notification immediately and stop any manual ringtone/vibration.
- Safety net: `setTimeoutAfter(45000)` on the notification.
- Write tests for the full call-state flow before anything else in this phase.

Remote control:
- Ringer/vibrate/silent (requires Do Not Disturb access), per-stream volume (AudioManager), media play/pause/skip (NotificationListenerService + media sessions), find-my-phone (loud ring overriding silent).

Automation rules:
- Prayer time → silence both phones, restore after.
- Battery below threshold → notify and enable battery saver where possible.
- Call answered on either phone → silence the other.

Reliability:
- In-app HyperOS setup checklist: Autostart, battery "No restrictions", lock in recents, DND access, notification access.

Security:
- Explicit device pairing, signed and expiring commands with replay protection, RLS so only the user's own paired devices can command each other, persistent "controllable by [device]" notification on the controlled phone, acknowledgement with real state for every command.

Play Store compliance:
- Call-log and related permissions are restricted; prepare the permissions declaration for the cross-device call-sync use case before public release.

## 12. Phase 9 — Existing backlog
- Ship the Week/cadence screen after a real-data check.
- Serious/RPG skins switch.
- Private usage analytics (minimal data, consent-based, no third-party trackers by default).
- UX pass across web and Android using the Phase 2 design system.
- Electricity tiered-rates feature with correct tier logic, edge cases and tests.
- Notes redesign.
- Life-dimension indices based on Maslow's hierarchy.

## 13. Phase 10 — Mass adoption
- Landing page that explains the value in seconds, with real screenshots.
- Two-minute onboarding that builds the user's first yearly goal with them.
- Goal and program templates so no one starts from a blank screen.
- PWA support, performance budget (fast first load), SEO basics.
- Arabic and English, full RTL.
- Privacy policy, data export, account deletion.

## 14. Phase 11 — Enterprise and college
- College: semester planning, course and assignment tracking, deadline-aware goal breakdown, cohorts.
- Enterprise: team and shared goals, roles and permissions, admin dashboard, SSO, org-level analytics.

## 15. Non-functional requirements
- Performance: <100 ms interaction response; optimistic UI; no blocking spinners on common actions.
- Offline-first on Android and web.
- Security and privacy by default: strict RLS everywhere, least-privilege permissions, sensitive data (health, family, children) private by default.
- Accessibility to WCAG 2.1 AA.
- Internationalization: Arabic and English from the start.
- Observability: error monitoring, structured logs, health checks.

## 16. Definition of done (every feature)
- Works on web and Android where applicable, online and offline.
- RLS verified; no cross-user data access.
- Tests written and passing in CI.
- Matches the design system; light, dark, RTL and both skins checked.
- Empty, loading, error and offline states handled.
- Documented in the repo (what it does, how it works, how to test).

Start with Phase 0. Do not change any code until I approve the audit report.

## Phase 9 — Document intelligence pipeline (shared by Medical, Vehicle, Receipts)
One reusable pipeline: capture → AI extraction → validation → user review → save.

Capture:
- Camera scan with auto-crop and enhancement, image or PDF upload, and Android "share to Life OS".
- Files go to a private Supabase Storage bucket, under a per-user path, with storage RLS.

Extraction:
- A Supabase Edge Function sends the document plus a task-specific system prompt and a strict JSON schema to the Claude API, using structured output or tool use. The API key never reaches the client.
- Prompts live in the repo, versioned (e.g. `prompts/lab_report_v1.md`), each with its own schema.
- Model choice by task: a fast, cheap model for receipts and fuel slips; a stronger model for lab reports and medical notes.

Validation:
- Validate every response against the schema (e.g. zod).
- Reject and retry once on invalid JSON.
- Every field carries a confidence value; unreadable fields come back as null and are never guessed.

Review:
- Nothing is saved automatically. A review screen shows the extracted fields next to the original image, highlights low-confidence fields, and lets the user correct them.
- Corrections are stored to improve prompts later.

Quality:
- A fixtures folder of sample documents (anonymized) with expected outputs.
- Extraction tests run in CI whenever a prompt changes.

Consent and cost:
- Explicit opt-in before any document is sent to an AI provider, with a clear explanation of where it goes. Optional redaction of name and ID numbers before sending.
- Rate limits per user, caching of results, and usage tracking.

## Phase 10 — Medical history
Profiles:
- One medical profile per person (self, children, parents), linked to the `people` table.

Records:
- Conditions, medications (name, dose, schedule), allergies, vaccinations, surgeries, doctor visits, prescriptions, imaging reports, insurance details, doctor contacts.

Lab results:
- Each test is stored as its own row: test name, value, unit, the report's reference range, flag, date, lab.
- Units are normalized so the same test can be charted over time across different labs.
- Trend charts per test, e.g. hemoglobin across two years.

Reading the report:
- The AI extracts the values *and* the notes and comments printed under the results as separate fields.
- It gives a short plain-language explanation of each test in Arabic or English.

Reminders:
- Medication and refill reminders, appointment reminders, vaccination schedules for children.

Doctor-visit prep:
- One tap generates a clean PDF summary (current medications, allergies, recent labs with trends) to show a doctor.

Safety rules (hard requirements):
- Explanations are educational only: no diagnosis, no treatment or medication-change advice.
- Flags are based only on the reference range printed on the report, never on general assumptions.
- Values marked critical or far outside range show "contact your doctor promptly", prominently.
- Every explanation screen carries a short "not medical advice; discuss with your doctor" note.

Privacy (highest sensitivity tier):
- Strict RLS, encryption at rest, a separate biometric or PIN lock for the medical section.
- Explicit per-record sharing only, an access audit log, and zero analytics on medical content.
- Before public release, review data-protection law for health data: Egypt's Personal Data Protection Law (Law 151 of 2020), and GDPR if there are EU users.

## Phase 11 — Vehicle history
Vehicles:
- Make, model, year, plate, fuel type, purchase date and price, optional VIN.

Odometer:
- Quick odometer entry; the app learns average km per day to predict upcoming services.

Service log (by km and date):
- Oil and filter changes, air and cabin filters, tires (rotation and replacement), brakes, battery, coolant, spark plugs, timing belt, AC service.
- Each entry records parts, labor, cost, workshop and odometer reading.

Service intervals:
- Configurable rules per item, "every X km or Y months, whichever comes first".
- Reminders when a service is due soon by km *or* time.

Fuel log:
- Liters, cost and odometer → consumption (L/100 km), cost per km, and monthly fuel spend.

Receipts:
- Scan a workshop or fuel receipt → extract workshop, date, odometer, line items (parts and labor), and total → automatically suggest service-log entries for review.

Documents and expiry:
- Car license renewal, insurance, inspections and warranty, with expiry reminders.

Costs:
- Total cost of ownership, cost per km, and spend by category, linked to the budget and purchase goals in the goal engine.

Resale:
- Export the full service history as a PDF.

## General receipts
- Any receipt can be scanned and categorized (groceries, medical, car, home, gym), linked to purchase goals and budgets.
- Itemized extraction where available, and warranty tracking for electronics and appliances.

## Phase 1A — Launch readiness (top priority: production-grade for mass adoption)
Principle: ship a focused, secure, polished v1 (goal engine, Today, Health & Gym, prayer, accounts and subscriptions). Other modules ship in later releases.

Security:
- Use OWASP ASVS (web) and OWASP MASVS (Android) as checklists; track every item.
- Strict RLS on every table and storage bucket; automated tests that attempt cross-user reads and writes and must fail.
- Service-role key only in Edge Functions; no secrets in the frontend bundle or APK; GitHub secret scanning.
- WAF, rate limiting on auth and AI endpoints, bot protection on sign-up, security headers (CSP, HSTS).
- Dependabot and vulnerability scanning; pinned dependency versions.
- Android: Keystore for keys, encrypted local storage, R8 obfuscation, Play Integrity API for sensitive actions.
- Encryption at rest, point-in-time backups with a tested restore, audit log for sensitive actions.
- Account deletion in-app and on the web; full data export.
- Professional penetration test before public launch; responsible-disclosure page.
- Privacy policy, terms, consent flows; Egypt's data-protection law and GDPR compliance.

Authentication (fingerprint login):
- Passkeys as the primary sign-in on web and Android, with Google sign-in as the stable fallback and email as recovery.
- Web: Supabase JS passkey methods (experimental opt-in). Android: Credential Manager runs the ceremony; Supabase issues challenges and verifies.
- Publish assetlinks.json on the production domain; fix the relying-party domain before enabling passkeys.
- Multiple passkeys per account; users can list, rename and remove them.
- BiometricPrompt app unlock on Android with device-PIN fallback and an inactivity timeout.
- Step-up fingerprint approval for medical records, device remote control, billing, data export and account deletion.
- Device and session management: see active sessions, sign out other devices; refresh-token rotation.
- Organization policy: admins can require passkeys or 2FA and revoke member devices.
- All auth code behind one internal module so beta API changes stay contained.

Subscriptions:
- Plans: Free, Pro, Family, Organization (per seat for enterprise and college).
- Web: a merchant of record (Polar or Paddle; confirm Egypt seller support during onboarding).
- Local Egyptian payments: Paymob or Fawry (cards, wallets, cash points); verify recurring billing.
- Android: Google Play Billing for in-app digital subscriptions.
- One entitlements layer (RevenueCat or own table) so every platform checks a single "plan" status.

Native Android app:
- Kotlin, Jetpack Compose, Material 3, standard Gradle build.
- Room (local DB), WorkManager (sync), FCM (push).
- Feature-parity checklist against web, plus widgets, Live Updates and the device-sync agent.
- Register an organization Play Console account (D-U-N-S) to skip the closed-testing requirement for new personal accounts.
- Staged rollouts, crash reporting, in-app update prompts.

Hosting and infrastructure:
- Move the frontend from Vercel (the Hobby plan doesn't allow commercial use) to Cloudflare Pages/Workers; keep Vercel live until the new host is verified, then switch DNS.
- Supabase Pro: separate staging and production projects, point-in-time recovery, connection pooling, read replicas when needed, monitoring and alerts.
- Status page, incident-response plan, uptime targets.

Not now: no Rust rewrite. Revisit a shared Rust core (goal engine, scheduling, sync compiled to WebAssembly and called from Kotlin) only once those engines are stable.
