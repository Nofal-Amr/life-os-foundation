---
tags:
  - principle
  - feature
aliases:
  - RPG skin
  - Serious skin
updated: 2026-09-22
---
# Skins: Serious and RPG

Chosen in [[Settings]]; stored as `user_preferences.skin`.

| | Serious (default) | RPG (opt-in) |
|---|---|---|
| Hub on [[Today]] | plain "done of scheduled" counts | character sheet: level, XP bar, per-area level and 0-100 stat |
| Logging something | a normal confirmation | also "+XP" toast |
| Streaks | none | prayer streak (days with all five prayed) |

## XP values (`src/data/hub.ts`)
Task or step 10 · prayer: jamaah 15, on time 10, late 5 · dose 5 · habit check-in 5 · transaction 2 · per 1,000 steps 1 · workout 10 · night of sleep 5.

Level: 50 XP to level 2, each level 25% further (`levelFor`).

## Dimensions (loosely Maslow)
Body (Physiological) · Money (Safety) · Work (Esteem) · Spirit (Self-actualisation) · Habits (Growth).

Code: [[Hub and character sheet]], `src/hooks/useXp.ts` for the toasts.
