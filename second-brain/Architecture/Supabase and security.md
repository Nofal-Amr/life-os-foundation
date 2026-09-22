---
tags:
  - architecture
  - security
aliases:
  - Security
  - RLS
updated: 2026-09-22
---
# Supabase and security

Project `albrfuugjiimogrtepql`. The app ships only the **anon** (publishable) key; that is by design.

## Row-level security
- Every table has RLS with "own rows only" policies (`auth.uid() = user_id`).
- Checked 2026-09-22: an anonymous request returns 0 rows from every table, including ones created outside the repo (`account_pockets`, `foods`, `food_logs`, `resources`, `resource_readings`).
- Service-role client (`client.server.ts`) is server-only and not imported by browser code.

## Headers (`src/lib/security-headers.ts`)
`frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/payment off, geolocation self), COOP. HSTS comes from Vercel. Scripts are not CSP-restricted yet (inline theme script needs nonces).

## Auth
Google sign-in plus email/password. New passwords need 8+ characters (sign-in doesn't enforce it, for older accounts). Android returns via `lifeos://auth-callback`. See [[Workflows/Sign in with Google]].

## Missing columns
`writeWithColumnFallback` drops a column the database doesn't have yet and `MigrationNotice` names the SQL file. See [[Migrations]].

> [!warning] Open items
> OAuth uses the implicit flow; PKCE would stop another Android app injecting a login. Five tables' schemas aren't in the repo. See [[Roadmap and known issues]].
