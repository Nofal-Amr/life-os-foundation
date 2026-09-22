---
tags:
  - architecture
updated: 2026-09-22
---
# Stack

- **TanStack Start** (React 19, TanStack Router file routes; `src/routeTree.gen.ts` is generated) on **Vite 8** via `@lovable.dev/vite-tanstack-config`.
- **Tailwind v4** + **shadcn/ui** (Radix), **lucide** icons, **sonner** toasts.
- **TanStack Query** for data (`networkMode: "always"` so [[Offline and sync]] can answer).
- **recharts**, **date-fns**, **adhan** (prayer times).
- **Supabase**: auth + Postgres with RLS. See [[Supabase and security]].
- Server entry `src/server.ts` wraps SSR and adds security headers.
- Unit tests: Vitest (`*.test.ts`). E2E: Playwright (`e2e/*.e2e.ts`). See [[Testing]].

Folders: `src/routes` pages · `src/components/app` app components · `src/components/ui` primitives · `src/data` data + pure logic · `src/lib` helpers · `mobile/android` native app · `supabase/migrations` SQL.
