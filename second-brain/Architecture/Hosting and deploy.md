---
tags:
  - architecture
  - runbook
updated: 2026-09-22
---
# Hosting and deploy

- **Web**: Vercel, auto-deploys every push to `main` of `github.com/Nofal-Amr/life-os-foundation`. Live at [lifeos0.vercel.app](https://lifeos0.vercel.app).
- Not Lovable (README still mentions it). The GitHub homepage link `life-os-foundation-rouge.vercel.app` is dead; per-deploy URLs need a Vercel login.
- **Branches**: work on `at-a-glance`, fast-forward into `main`, push both. Never rewrite pushed history.
- **Android**: `npm run build:android`, then send the APK. See [[Android app]].

Runbook: [[Workflows/Release web and Android]].
