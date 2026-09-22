---
tags:
  - architecture
updated: 2026-09-22
---
# Offline and sync

`src/lib/offline.ts` wraps `window.fetch` for Supabase REST (`/rest/v1/*`).

- IndexedDB store `life-os-offline`: a `responses` cache and an `outbox`.
- **Reads**: stale-while-revalidate. The cached answer shows instantly; a background refresh re-renders only if the data changed.
- **Writes offline**: queued in order, applied to the local copy (upserts merge on their conflict columns), replayed when back online.
- **Sign-out** clears the cache and outbox (`useSignOut`), so a shared device keeps nothing.
- `SyncIndicator` shows offline / syncing state.

Related: [[Android app]] (same layer inside the WebView), [[Workflows/Work offline]].
