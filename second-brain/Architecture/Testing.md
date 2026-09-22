---
tags:
  - architecture
  - testing
updated: 2026-09-22
---
# Testing

| Kind | Command | Covers |
|---|---|---|
| Unit | `npm test` (Vitest) | pure logic in `src/data` and `src/lib` (week placement, tariffs, links, habit categories, security headers...) |
| E2E | `npm run test:e2e` (Playwright, installed Chrome, desktop + Pixel 7) | intro page, section picker keyboard, sign-up/sign-in, protected-route redirects, no sideways scroll, no console errors |
| Types | `npx tsc --noEmit` | strict TS with `exactOptionalPropertyTypes` |
| Build | `npm run build` | production bundle |

E2E files end in `.e2e.ts` so Vitest ignores them. Signed-in screens aren't covered by E2E (no test account yet). See [[Roadmap and known issues]].
