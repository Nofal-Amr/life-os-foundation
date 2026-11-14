---
tags:
  - workflow
updated: 2026-09-22
---
# Release web and Android

1. `npx tsc --noEmit`, `npm test`, `npm run test:e2e`, `npm run build`.
2. Commit only the intended files (never `git add -A`).
3. `git checkout main && git merge --ff-only at-a-glance && git push origin main`, then push `at-a-glance`.
4. Vercel deploys; check lifeos0.vercel.app.
5. `npm run build:android:release` → send `mobile/android/build/life-os-release.apk` (needs your release key; see `docs/android-release-signing.md`). Debug builds are for your own phone only.

**Related**: [[Hosting and deploy]] · [[Android app]] · [[Testing]]
