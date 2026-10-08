---
tags:
  - vision
  - business
updated: 2026-10-08
---

# Enterprise and business (vision, not built)

Decided 8 Oct 2026: Life OS stays one personal app with modes (Student mode exists). An enterprise version is a **plan** for later, written here so it isn't lost. Nothing below is built.

## Who it would be for

| Who | What they'd pay for |
|---|---|
| Small teams and family businesses (shops, clinics, workshops) | Shared tasks and calendar, simple money in/out, recurring bills, staff "Together" spaces |
| Freelancers and consultants | Time tracking per client, invoices from logged time, "Going to work" costs as expenses |
| Students' families / tutors | Study mode shared with a parent or tutor (read-only view of due dates) |
| Companies wanting staff wellbeing tools | Opt-in, anonymous, aggregate-only check-ins — never individual tracking |

## What exists that it would build on

- **Together** (shared spaces with invite codes, member-only access) → teams and roles.
- **Money** (accounts, categories, recurring costs, left to spend) → bookkeeping for a small business.
- **Time tracking** and **tasks/projects** → client work and invoicing.
- **Export to Excel** → accountant hand-off.
- **Offline-first app + Android/iOS shells** → field staff.

## What it would need first

1. **Organisations**: an `orgs` table, members with roles (owner, admin, member, viewer), every shared table scoped by `org_id` with row-level security, audit log of changes.
2. **Accounting basics**: double-entry ledger underneath the simple money view, VAT/tax fields, invoices and receipts (photo reading already exists), Egyptian e-invoice format (ETA) support.
3. **Billing**: subscriptions (Paymob / Stripe), per-seat pricing, a free personal tier that stays free.
4. **Admin**: SSO for companies, data retention settings, data export per org, a DPA.
5. **Separate personal and work data**: a person's own Life OS (prayers, health, diary) is never visible to an employer. Work spaces are separate orgs they're invited into.

## Rules that carry over

- Real data only: reports show what was logged, with sample sizes; no scores or rankings of people.
- No employee surveillance features (no screen tracking, no "productivity scores").
- Privacy by default: an org sees only what's in the org.

## Monetisation options

| Option | Notes |
|---|---|
| Free personal app, paid team spaces | Together stays free for families; teams pay per seat |
| One-off "Pro" for power features | e.g. bigger AI model downloads, unlimited history charts, priority sync |
| Business bookkeeping plan | Invoices, VAT, accountant access |

## Open questions

- Arabic-first market (Egypt, Gulf) or global English first?
- Hosting: stay on Supabase + Vercel, or self-host for business customers?
- Who does support?

Related: [[Original plan - Real-life RPG operating system]] · [[Ideas backlog]]
