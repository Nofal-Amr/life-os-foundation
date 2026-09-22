---
tags:
  - principle
  - design
updated: 2026-09-22
---
# Design system

Tokens live in `src/styles.css` (oklch, `:root` light, `.dark` dark).

- **Two looks**: light "Executive Obsidian Crisp" (blue primary, 8px buttons) and dark "Pro Dark" (near-black, cyan `oklch(0.79 0.129 187)`, pill buttons). Both from Stitch designs.
- **Font**: Hanken Grotesk Variable, bundled (`@fontsource-variable/hanken-grotesk`) so it works offline. Tabular numbers on.
- **Type floor**: 12px; `text-2xs` (11px) only for dense chart axes.
- **Shapes**: surfaces 16px · wells 12px · fields/menus 10px · buttons `--button-radius` · sheets 24px · chips full.
- **Surfaces**: `system-card` (flat) and `stat-card` (lifted); shadcn `Card` uses `system-card`.
- **Utilities**: `section-title`, `axis-label`, `figure`, tone utilities `tone-*`, entity colours `--entity-*`.
- **Focus**: 2px ring with offset everywhere; touch targets grow to 44px on coarse pointers.

See [[Motion]] and the audit history in [[Decisions#Redesign in place]].
