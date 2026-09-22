---
tags:
  - principle
  - design
updated: 2026-09-22
---
# Motion

Restrained, purposeful (Emil Kowalski's rules).

- Easing tokens: `--ease-out` (0.23,1,0.32,1), `--ease-in-out`, `--ease-drawer` (sheets).
- Sheets 300ms in / 200ms out; dialogs 200/150ms, centred; popovers from their trigger.
- Press feedback `scale(0.97)`; hover only on hover-capable devices.
- **Moments**: figures roll on change (`AnimatedNumber`), next action eases in, quick-add tiles arrive one by one, checkboxes pop, crossing-off fades in, section-tab underline slides.
- **Reduced motion** keeps fades and colour changes, removes movement (global rule in `styles.css`).
