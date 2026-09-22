---
tags:
  - decision
  - moc
updated: 2026-09-22
---
# Decisions

## No Capacitor
The Android app is a hand-built WebView (aapt2/javac/d8). Smaller, no Gradle, full control of the bridge. See [[Android app]].

## Vercel, not Lovable
Deploys from `main`. See [[Hosting and deploy]].

## Redesign in place
Kept the two Stitch looks; unified radii and cards, Hanken Grotesk, 12px floor, one mobile menu (bottom bar "More"), sliding tab underline. See [[Design system]].

## Derived links over new columns
Projects ↔ goals come from task links, so no migration was needed. See [[Data model#Links (derived, no extra columns)]].

## Guess, then let the user choose
Habit categories are guessed from names and marked "(guessed)". See [[Habits]].

## Games are opt-in
XP, levels and streaks only in the RPG skin, each explained. See [[Skins - Serious and RPG]].

## Conservative security headers
No script CSP yet (needs nonces for the inline theme script); everything else on. See [[Supabase and security]].
