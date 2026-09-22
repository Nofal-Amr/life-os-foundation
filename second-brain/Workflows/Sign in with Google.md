---
tags:
  - workflow
updated: 2026-09-22
---
# Sign in with Google

- **Web**: Google → back to `/auth` → session → [[Today]].
- **Android**: Google opens in the phone browser → `lifeos://auth-callback` → the app loads `/auth?return=...` with the tokens.
Supabase Site URL and redirect URLs must include the web origin and `lifeos://auth-callback`.

**Related**: [[Supabase and security]] · [[Android app]]
