# Spirit: prayer, azkar and Quran benchmark

Date: 12 November 2026. This follows the method in `competitive-benchmark-brief.md` (spec section 10) and goes deeper than section 5 of `2026-11-12-competitive-benchmark.md`, which rated Spirit "excellent" only because no planning app has a Spirit section at all. This report compares Spirit with the apps Muslims actually use for prayer.

## How to read this

| Label | Meaning |
|---|---|
| **Verified** | Read on the official App Store listing or the product's own site on 12 Nov 2026 (links in Sources). |
| **Reported** | Found only in third-party trackers, press or reviews. Named as such. |
| **Observed** | Seen in the Life OS code on `main` (`src/routes/_authenticated/spirit.tsx`, `src/components/app/*`, `src/data/spirit.ts`, `src/data/azkar.ts`) and in `mobile/native`. |
| **Estimate** | My judgement. **Every competitor score is an estimate.** No competitor was installed or used. |

What was not done:
- no competitor app was installed;
- no hands-on accuracy test against a mosque timetable;
- no store download figures from a paid source (Sensor Tower, AppMagic).

App Store prices vary by country, and the same listing often shows several overlapping tiers, so prices below are the US listing unless stated.

The owner also sent a friend's prayer app, Azka Qibla Finder. Section 9 covers what it taught.

Updated 13 Nov 2026:
- added the friend's app and the owner's decisions on alarms;
- the implementation log now links the pull requests.

---

## 1. Who competes

| Group | Products | What they are |
|---|---|---|
| **All-in-one Muslim apps** | Muslim Pro, Athan (IslamicFinder), Sajda, Prayer Now, Salatuk, Al-Moazin | Prayer times, adhan, Qibla, Quran, duas, calendar, often a community feed. Most are funded by ads and subscriptions. |
| **Calm, privacy-first prayer apps** | **Pillars**, **Mawaqit**, Athan Utility | Few features, no ads. Pillars charges for extras; Mawaqit is free and runs on donations; Athan Utility does its calculations on the device. |
| **Mosque-linked times** | **Mawaqit** | The mosque publishes its own adhan and iqamah times, and the app shows them. It's the most accurate answer to "when does *my* mosque pray?" |
| **Azkar specialists** | Hisn Elmoslem (open source, on F-Droid), many "Adhkar" apps | The Hisn al-Muslim book with a counter for each zikr. The best ones are ad-free; many others are full of ads. |
| **Quran specialists** | Quran.com apps, Tarteel, Ayah | Reading and listening (Quran.com, free). Memorisation with AI that catches mistakes (Tarteel, paid). A clean mushaf reader (Ayah). |

**For the Egyptian and Arabic market:**
- **Salatuk (Masarat)** and **Prayer Now (App Rocks)** are the big installed bases.
  - 42matters reports Salatuk at 50M+ Google Play downloads and Prayer Now at 10M+.
  - Another tracker shows Salatuk at 10M+, so the figures disagree. Both are reported, not verified.
- **Al-Moazin** is also listed at 10M+ (reported).
- **WeMuslim** appeared as a top lifestyle app in Egypt on an undated chart (reported).
- Muslim Pro is the global leader: 601K ratings on the US App Store (verified).

**Where Spirit sits.** Spirit is not trying to be a Quran app or a community. Its realistic rivals are the calm prayer trackers (**Pillars**, Mawaqit's prayer side) and the azkar counters. For an Egyptian user, the incumbent it must be good enough to replace is Salatuk or Prayer Now.

Its unique position: **prayer is part of the same day as your tasks, money and health.** None of the apps in this report can do that.

```
                     Many features (Quran, community, store…)
                                   ▲
              Muslim Pro ●         │
          Athan (IF) ●  ● Prayer Now
                 Salatuk ●  ● Sajda│
                  Al-Moazin ●      │        ● Mawaqit
  Ads, tracking ◄──────────────────┼──────────────────►  No ads, private
                                   │   ● Pillars
                                   │       ● Life OS Spirit
                                   │   ● Hisn Elmoslem   ● Athan Utility
                                   ▼
                      Few features (prayer / azkar only)
```

---

## 2. What each one teaches

**Muslim Pro** (verified, App Store US)
- Its features include:
  - adhan notifications and an adhan alarm that can wake you for Fajr;
  - Quran text and audio, with offline Quran in Premium;
  - a Hijri calendar;
  - a Ramadan companion with suhoor and iftar times and an iftar countdown;
  - duas and a tasbih;
  - a prayer and fasting tracker **with streaks**;
  - "Quests" that award points;
  - a halal places finder and a community feed;
  - an Apple Watch app.
- Pricing: free with ads. Premium is $34.99/year on the description; the listing also shows tiers from $0.99 to $59.99.
- Privacy label: **location and identifiers are "used to track you"**, and name, email, phone, photos and device ID are "linked to you".
- In November 2020, Motherboard reported that Muslim Pro sent location data to the broker X-Mode. The company denied selling data to the US military but ended the relationship (Al Jazeera, 17–18 Nov 2020).
- *Lesson:* breadth and gamification win installs, but the faith app with the most users is also the one users trust least. That gap is Life OS's opening.

**Pillars** (verified, App Store US)
- It includes:
  - a prayer tracker with on time, late and missed;
  - early or late Asr by madhab, and several calculation methods;
  - **a pause for menstruation**;
  - a fasting tracker that records missed fasts, their reasons and when they were made up;
  - "Smart Qibla" with calibration;
  - home and lock screen widgets;
  - a notification for each prayer, which you can switch off.
- "Local mosque prayer times" is listed as coming soon.
- No ads: "adverts don't belong on a Prayer app". The privacy label lists identifiers, usage and diagnostics, none linked to you.
- Premium adds themes and Apple Watch, at $49.99–59.99 a year or $11.99 a month. One review says the home-screen widget became paid.
- Rated 4.8 from 5.6K ratings.
- *Lesson:* the closest product to Spirit's spirit. Few features, beautiful, private, and it respects real life. The menstruation pause and the qada log for missed fasts are care, not features.

**Mawaqit** (verified, App Store US and mawaqit.net)
- The mosque's own salah and **iqamah** times, updated live when the imam changes them.
- Azan with several muezzin voices and pre-notification times.
- Imsak and iftar times, a Qibla compass, and a Hijri calendar you can download as a PDF.
- Quran and azkar.
- Widgets, Apple Watch, CarPlay, Garmin and Home Assistant.
- Free, no ads, open source, run by a non-profit on donations.
- Privacy label: "Data Not Collected". In 21 languages, including Arabic. Rated 4.9.
- *Lesson:* accuracy means "matches my mosque", not "matches an algorithm". The iqamah time is what people actually plan around.

**Athan by IslamicFinder** (reported; the App Store page refused the request with HTTP 429)
- Free with ads. Remove Ads is about $3.99, and Premium is about $11.99/year (one listing; a tracker says $9.99).
- Extra adhan audio is a paid feature.
- Treat these details as reported.

**Sajda** (verified, App Store listing snippets)
- It shows:
  - "scholar-approved" times, **a countdown to the next prayer**, and adhan with **before-prayer and iqamah reminders**;
  - Qibla by compass or map;
  - widgets and a prayer calendar;
  - an Apple Watch widget;
  - a Duha prayer tracker.
- It describes itself as ad-free, with in-app purchases.
- *Lesson:* a countdown and a reminder before the iqamah are now the baseline.

**Salatuk (Masarat)** (verified, App Store listing; installs reported)
- Automatic location, Qibla and "a large number of calculation methods".
- The developer itself says the times may be off in some countries and tells users to adjust them by hand to match official sources.
- iOS plays four takbeers instead of the full adhan when the app is closed.
- Reviews mention having to correct the times by hand.
- *Lesson:* even the incumbents get local times wrong. **Per-prayer minute adjustments are a must**, and so is a clear note of which method is in use.

**Prayer Now** (verified, App Store listing)
- In English, Arabic and French.
- Azkar for the morning, the evening, **before sleep and after prayer**, to read or listen to.
- Customisable widgets with prayer times and the Hijri calendar.
- The listing's last notes are only bug fixes, with a 2022 copyright.
- *Lesson:* Arabic users expect after-prayer and sleep azkar, not only morning and evening.

**Al-Moazin** (verified, App Store listing)
- GPS times with Umm al-Qura, **Egyptian General Survey Authority**, Karachi, ISNA and MWL.
- A Hijri calendar, a digital Qibla and a Fajr alarm.
- Wear OS support is claimed only by a third-party site (unverified).

**Athan Utility** (verified, App Store listing)
- 12 calculation methods, Shafi or Hanafi.
- Calculated on the device, with no ads and no data collected.
- Widgets and Apple Watch.
- *Lesson:* "nothing leaves your phone" is a simple promise users understand.

**Hisn Elmoslem** (reported: F-Droid and a Google Play mirror)
- All of Hisn al-Muslim.
- A counter that vibrates when a zikr is finished, plus a free tasbih with an endless or countdown counter.
- Count with the volume buttons.
- Ad-free and open source. Rated about 4.95, updated 11 Mar 2026.
- *Lesson:* the gold standard for azkar is plain text, a big count, a vibration when you finish, and no distraction.

**Quran.com apps** (verified on quran.com/apps and the App Store)
- Free, ad-free reading. Quran Audio, released 27 Feb 2026, has offline downloads, playlists, khatma tracking and verse-synced text.
- The Android app is open source. Its ad status is reported differently by different blogs.
- *Lesson:* never build a Quran reader. Link to one.

**Tarteel** (verified, support centre and App Store)
- AI that catches recitation and memorisation mistakes, including tashkeel, is a Premium feature.
- Prices vary widely by listing, from $5.99 to $19.99 a month.
- There is a discounted plan for people in financial need.
- *Lesson:* a specialist moat Life OS should not chase.

**Ayah** (verified, App Store listing)
- A clean Quran reader with verse-by-verse audio highlighting, tafsir and translations.
- Free with in-app purchases.

---

## 3. Feature matrix

Ratings: **E** excellent, **G** good, **B** basic, **W** weak, **–** missing.
- Spirit's ratings are **observed** in the code.
- Competitor ratings are **estimates** from their listings.

| Capability | Spirit (web) | Muslim Pro | Pillars | Mawaqit | Athan (IF) | Sajda | Salatuk | Prayer Now | Hisn Elmoslem |
|---|---|---|---|---|---|---|---|---|---|
| Prayer-time calculation | G¹ | G | G | **E**² | G | G | G | G | – |
| Choice of method and madhab | G¹ | G | G | n/a² | G | G | G | G | – |
| Per-prayer minute adjustment | **–** | G | B | n/a | G | B | G | G | – |
| Next-prayer countdown | **–**³ | G | G | G | G | G | G | G | – |
| Adhan and notifications | W⁴ | E | G | E | E | G | G | G | – |
| Pre-adhan and iqamah reminder | –⁴ | B | B | **E** | B | G | B | B | – |
| Widgets | W⁵ | G | G | G | G | G | G | G | – |
| Watch | W⁶ | G | G | G | B | G | B | B | – |
| Prayer log | **E**⁷ | G (streaks) | G | B | B | B | – | B | – |
| Logging without guilt | **E**⁸ | W | G | n/a | n/a | n/a | n/a | n/a | n/a |
| Menstruation pause | **–** | – | **G** | – | – | – | – | – | – |
| Qada (making up missed prayers) | – | B | G (fasts) | – | – | – | – | – | – |
| Morning and evening azkar with counter | **E**⁹ | G | – | B | B | G | – | G | **E** |
| After-prayer azkar | **–** | G | – | B | B | G | – | G | E |
| Sleep and other daily azkar | **–** | G | – | B | B | G | – | G | E |
| Tasbih | G¹⁰ | G | – | – | G | G | – | G | G |
| Qibla | G¹¹ | G | G | G | G | E | G | G | – |
| Quran | **–** | E | – | G | G | G | – | G | – |
| Hijri date and calendar | B¹² | G | – | G | G | G | B | G | – |
| Ramadan (imsak, iftar, fasting log) | **–** | E | G (fasts) | G | G | G | B | G | – |
| Arabic and RTL | G¹³ | G | B | G | G | G | **E** | **E** | **E** |
| Offline | **G**¹⁴ | B | G | G | B | G | G | G | E |
| No ads | **E** | W | E | E | W | G | W? | W? | E |
| Privacy | G¹⁵ | **W**¹⁶ | G | **E** | B | B | ? | ? | E |
| Calm design | **G** | W | **E** | G | W | G | B | B | G |
| Link to the rest of the day | **E**¹⁷ | – | – | – | – | – | – | – | – |

Notes:
1. On-device calculation with the `adhan` library: 12 methods (MWL, Egyptian, Karachi, Umm al-Qura, Dubai, Moonsighting, ISNA, Kuwait, Qatar, Singapore, Turkey, Tehran) and Shafi or Hanafi Asr. But **onboarding defaults to Muslim World League** (`Onboarding.tsx:59`) even for Egyptian users, and the Spirit page never says which method it is using.
2. Mawaqit shows what each mosque publishes, rather than calculating.
3. A "Next" tag on the row, but no time remaining. After Isha the `next` value is `"none"`, so the tag disappears until midnight.
4. Notifications exist only in the Android wrapper app (`PrayerReminders.tsx`). On the web, Spirit says "Prayer reminders arrive as notifications in the Life OS Android app". There's no adhan audio and no iqamah offset.
5. Android home-screen widget in the old web-view app (`prayerWidget.ts`). None on the web, and planned for native.
6. A Wear OS project exists (`npm run build:wear`). Not shipped to users.
7. Seven rows (the Sunnah of Fajr, the five, Witr), with five statuses (in jamaah, on time, clutch, late, missed), Jumu'ah on Fridays, a sunrise row, any past day, and logging from the notification button.
8. "N of 5" and "N of 35 over the last seven days", with no streaks, scores or verdicts (Life OS rules).
9. 20 azkar from Hisn al-Muslim, with tap-to-count cards, a vibration, auto-scroll to the next one, progress kept on the device, and "Log as read" for book readers. Ayat al-Kursi has full Madinah-mushaf tashkeel.
10. Eight phrases, targets of 33/99/100/1000, and the daily total saved.
11. Compass and map with the direction; it works offline once the location is saved.
12. Hijri dates are used for Islamic holidays on the calendar (`holidays.ts`, Umm al-Qura via `Intl`), but **the Spirit page doesn't show today's Hijri date**.
13. Arabic interface and RTL; azkar texts in Arabic with a proper Arabic font.
14. The web's offline layer and the native Room database.
15. Only you can read your data (row-level security); no third-party trackers. Not end-to-end encrypted. City lookup goes to Open-Meteo or BigDataCloud only when you search.
16. The App Store privacy label says it tracks you; the 2020 X-Mode report.
17. Prayer is a tile on Today, prayers appear on the Calendar, and Spirit habits live on Spirit. But tasks aren't planned around prayer times yet.

---

## 4. Scorecard (1–10)

All competitor scores are **estimates** from their listings and reputation. Spirit is scored on `main` today.

| | Accuracy and trust in the times | Reminders | Azkar and tasbih | Tracking without guilt | Calm and privacy | Arabic | Breadth | **Overall (estimate)** |
|---|---|---|---|---|---|---|---|---|
| **Life OS Spirit (web)** | 6 | **2** | 7 | **9** | 8 | 7 | 5 | **6** |
| Muslim Pro | 7 | 9 | 7 | 4 | 3 | 7 | **10** | 7 |
| Pillars | 7 | 7 | 1 | 8 | **9** | 4 | 4 | 7 |
| Mawaqit | **9** | 9 | 5 | 2 | **9** | 8 | 7 | **8** |
| Athan (IslamicFinder) | 7 | 8 | 5 | 3 | 4 | 6 | 8 | 6 |
| Sajda | 7 | 8 | 6 | 4 | 7 | 6 | 7 | 7 |
| Salatuk | 6 | 7 | 2 | 1 | 5 | **9** | 4 | 6 |
| Prayer Now | 7 | 8 | 7 | 2 | 5 | **9** | 7 | 7 |
| Hisn Elmoslem | n/a | 3 | **9** | n/a | 9 | **9** | 3 | 7 (azkar only) |

Why Spirit scores what it does:
- **Accuracy 6.** The calculation itself is sound (the same `adhan` library many apps use). But the default method is wrong for Egypt, the method used isn't shown, and times can't be adjusted by a few minutes to match the local mosque.
- **Reminders 2.** On the website, nothing rings. This is the biggest single gap: a prayer app that doesn't remind you can't replace the user's current one.
- **Azkar 7.** The morning and evening azkar are as good as Hisn Elmoslem's. After-prayer and sleep azkar are missing.
- **Tracking without guilt 9.** The best in this group: honest counts, no streaks, Sunnah and Witr, and a status that covers real life ("clutch", "late"). It misses a menstruation pause, which Pillars has.
- **Calm and privacy 8.** No ads and no trackers. It loses points for not saying so on the page.
- **Breadth 5.** By choice there's no Quran, no community and no Ramadan mode yet.

**Competitive position:** Spirit already has **the best prayer log and the calmest azkar counter** of any all-in-one app. It is **not yet a prayer app someone could switch to**, because it doesn't ring, doesn't count down and doesn't show the Hijri date. Those are cheap to fix on the web, except ringing.

---

## 5. Where Spirit is behind

1. **No reminders on the web.** Every competitor rings, most with a choice of adhan, and Sajda and Mawaqit also remind you before the iqamah. A web app can't ring reliably in the background without Web Push (a service worker and a server that sends). The Android app already does it.
2. **No time remaining to the next prayer.** It is the first line of every competitor's home screen.
3. **No Hijri date on Spirit.** Every Arabic-market app shows it at the top.
4. **The method isn't visible, and Egyptians get the wrong default.** Users can't check why Spirit differs from their mosque. Egypt's official method is the Egyptian General Authority of Survey (`Egyptian` in `adhan`), but onboarding picks Muslim World League.
5. **No per-prayer adjustment** ("+2 min to Maghrib to match my mosque"). Salatuk's developer tells users to adjust by hand; Spirit has no way to.
6. **Only morning and evening azkar.** After-prayer, sleep and waking azkar are expected (Prayer Now, Hisn Elmoslem, Muslim Pro).
7. **No menstruation pause.** The days show as gaps or "missed". For half of the users, that is a quiet form of guilt.
8. **No Ramadan mode:** imsak and iftar times, and a log of fasts and missed fasts.
9. **No Quran**, and no link to a good Quran reader.

---

## 6. Where Spirit can win

Spirit shouldn't become Muslim Pro. It should be **the prayer app that understands the rest of your day.**

1. **Prayer-aware Today.** Today's next action already sits next to the Prayer tile. Add "Asr in 40 min" to that tile, and the day reads as one: the next task fits before the next prayer. No prayer app knows your tasks.
2. **The day timeline anchored on prayers** (benchmark pattern 5). The prayers are fixed points, and tasks fall into the gaps between them, a rhythm Muslims already plan by ("after Asr"). Later, the capture line could understand "after Asr" as a time.
3. **Guilt-free by design, said out loud.** No streaks, no points, no "you missed 3". Plus a **menstruation pause** that hides the five for those days and leaves the counts honest ("Paused 5 days"). It's Pillars' idea, done with Life OS's rules.
4. **Private by default, said out loud.** "Prayer times are calculated on your device. Your location and prayer record are never shared or sold." That is true today and a direct answer to the Muslim Pro story.
5. **Azkar fitted to the moment.** After each prayer, offer the after-prayer azkar. In the morning and evening, offer the right set (`azkarTimeAt` already chooses). It's one tap from the prayer row, with no extra screen to manage.
6. **Accuracy you can check.** Show the method in use, suggest the local one, and allow small per-prayer adjustments. Later, an optional "my mosque's iqamah" offset for the reminder, which is what Mawaqit's users value.
7. **Ramadan without clutter.** For that month only, the iftar countdown takes the place of the next-prayer line, and fasts are logged like prayers.

---

## 7. Roadmap

### Essential (needed for someone to switch to Spirit)

| # | Item | Where | Needs a DB change? |
|---|---|---|---|
| E1 | **Next prayer and time left, plus today's Hijri date**, at the top of Spirit's Prayers tab. After Isha, count down to tomorrow's Fajr. | Spirit (web) | No |
| E2 | **After-prayer azkar** in the Azkar tab, with the same counter cards. The set comes from Hisn al-Muslim. | Spirit (web) | No for counting. Logging them would need `dhikr_logs.kind` to allow `'after_prayer'`: it currently allows only `('morning','evening','tasbih')`. |
| E3 | **Show the calculation method, and suggest the local one.** "Times: Muslim World League · Shafi". If the saved place is in Egypt and the method isn't Egyptian, suggest switching. | Spirit (web) | No (it writes the existing `calc_method`) |
| E4 | **Per-prayer minute adjustments** (−15 to +15). | Spirit settings | **Yes**: new nullable `prayer_settings.adjustments jsonb`. Needs approval of the exact SQL; staging first. |
| E5 | **Wake-up alarm before a prayer** (owner's decision, 13 Nov). One tap beside Fajr, Sunrise or any prayer sets a one-off alarm in the phone's own Clock app, N minutes before (default 10, with an optional value per prayer). It is a wake-up aid, not the adhan. | Spirit plus the Android bridge | No |
| E5b | **Reminders on the web** through Web Push, plus adhan sounds and a pre-iqamah reminder in the native app. **Postponed** by the owner ("not for now"); kept on the roadmap. | Platform | Yes, plus a server sender |
| E6 | **Plain privacy line on Spirit.** | Spirit (web) | No |

### Strong next steps
- **Menstruation pause:** a date range that pauses the five. Needs a table or a settings column; DB approval.
- Sleep and waking azkar.
- The Prayer tile on Today shows the time left (outside Spirit; after `web-simplify` lands).
- Native app: adhan choice and a pre-iqamah reminder, the widget, and a Wear OS tile (spec in `docs/superpowers/specs/2026-10-23-native-android-design.md`).
- Ramadan mode: imsak and iftar, plus a fasting log.

### Optional, later
- A link out to a Quran reader (Quran.com) rather than building one.
- A day timeline anchored on prayers (shared with the general roadmap).
- Mosque iqamah times (Mawaqit-style). This depends on a data source; never scrape.
- A Qada log for missed prayers and fasts.

**Deliberately not doing:**
- streaks and "Quests";
- a community feed;
- a halal places finder;
- in-app Quran memorisation AI;
- ads of any kind;
- selling or sharing location.

---

## 8. Implementation log

The first essentials go on their own branches, in Spirit only, so they don't clash with the `web-simplify` session. Each is tested and checked headless in demo mode. None is pushed without the owner's OK.

| Item | Pull request | State on 13 Nov |
|---|---|---|
| E1 Next prayer with the time left, and the Hijri date | [#18](https://github.com/Nofal-Amr/life-os-foundation/pull/18) | Merged, live |
| E2 After-prayer azkar, offered in the half hour after a prayer | [#27](https://github.com/Nofal-Amr/life-os-foundation/pull/27) | Green, waiting to merge |
| E3 + E6 The method line, the local-method suggestion and the privacy line | [#30](https://github.com/Nofal-Amr/life-os-foundation/pull/30) | Open |
| E5 Wake-up alarm in the phone's Clock app | [#32](https://github.com/Nofal-Amr/life-os-foundation/pull/32) | Open |

- #27 and #30 both add Arabic strings at the end of `src/lib/i18n.ar.ts`. Whichever merges second needs a one-line conflict fix.
- E4 (per-prayer minute adjustments) needs a new `prayer_settings` column, which needs the owner's approval of the exact SQL.
- Logging after-prayer azkar would need `dhikr_logs.kind` widened. Not requested.

### Still open from the benchmark and the friend's app
- A progress bar from the last prayer to the next, under the countdown, in Spirit and on the Today Prayer tile.
- Before-sleep and waking azkar sets.
- A meaning and transliteration toggle on the azkar cards. This needs carefully checked texts.
- An offline note that says what still works.
- A menstruation pause.

---

## 9. The owner's prayer app (research input)

**Azka Qibla Finder**, the owner's friend's app (Expo/React Native, `com.hajjumrah.ar` 1.0.0).

How it was examined:
- The APK was first read statically: the manifest, permissions and the text in its JavaScript bundle.
- With the owner's OK it was then run once on the Android emulator, with Cairo set as the location, and uninstalled afterwards.
- It was never installed on a real phone.

The full notes are in `second-brain/Competitor - Azka Qibla Finder.md`. Only principles are taken here, never its art, text or branding.

What it does well:
- **No account and no server.** Everything stays on the phone, with a clear "erase my data".
- **Offline city packs,** so prayer times work on first run with no connection.
- **A next-prayer hero card,** with a countdown and a progress bar from the last prayer to the next.
- **Azkar cards** with the Arabic, an optional transliteration, the meaning, the source and a count chip, with tap to count. It has five sets: morning, evening, after prayer, before sleep and on waking.
- An **offline banner that says what still works**.
- Four home-screen widgets: the next prayer, the times, an overview and the Qibla.

What it gets wrong, which Life OS should avoid:
- The **location permission and a paywall come before any value**.
- It puts **ads under the prayer times** and **charges for worship habits** (tasbeeh, azkar reminders).
- Its **default is Umm al-Qura even in Cairo**: Isha is about 10 minutes off and Fajr about 6 minutes off, against the Egyptian method.
- The azkar count resets when you switch tabs, and one choice is split over two segmented rows.
- Settings is one endless page.
- On x86 devices it crashes on launch (`libexpo-av.so` is missing), which is worth telling the friend.

Its estimated scores, on the scale in section 4:
- accuracy 5 (wrong default for Egypt);
- reminders 7;
- azkar 7;
- tracking –;
- calm and privacy 6 (private data, but ads);
- Arabic 8;
- breadth 7.

What changed in Life OS because of it:
- The local-method suggestion (#30) answers its wrong default.
- The after-prayer set keeps its count for the day and after each prayer (#27).
- One set picker (#27).
- The owner's rule stays: **no paywall and no ads on worship, ever**.

Still to take:
- the progress bar;
- the waking and sleep azkar sets;
- the meaning and transliteration toggles;
- the offline note;
- offline city lookup.

---

## Sources (all read 12 Nov 2026)

- Muslim Pro, App Store US: <https://apps.apple.com/US/app/id388389451>
- Muslim Pro and X-Mode, Al Jazeera, 17 Nov 2020: <https://www.aljazeera.com/news/2020/11/17/report-us-military-buying-location-data-on-popular-muslim-apps>; denial, 18 Nov 2020: <https://www.aljazeera.com/news/2020/11/18/muslim-pro-app-denies-selling-user-data-to-us-military>
- Pillars, App Store US: <https://apps.apple.com/us/app/-/id1559086853>
- Mawaqit, App Store US: <https://apps.apple.com/us/app/id1460522683>; site: <https://mawaqit.net/>
- Athan (IslamicFinder), App Store (refused with HTTP 429; prices from listing snippets): <https://apps.apple.com/app/id505858403>; price tracker (reported): <https://apppricinglab.com/iap/apple/505858403>
- Sajda, App Store: <https://apps.apple.com/us/app/-/id517254891>
- Salatuk, App Store: <https://apps.apple.com/us/app/id686077611>
- Prayer Now, App Store: <https://apps.apple.com/us/app/-/id1081440836>
- Al-Moazin, App Store: <https://apps.apple.com/us/app/al-moazin/id637678038>
- Athan Utility, App Store: <https://apps.apple.com/gb/app/athan-utility/id1076108131>
- Hisn Elmoslem, F-Droid: <https://f-droid.org/en/packages/com.hassaneltantawy.hisnelmoslem>
- Quran.com apps: <https://quran.com/apps>; Quran Audio, App Store: <https://apps.apple.com/us/app/id6759504275>
- Tarteel Premium, support centre: <https://support.tarteel.ai/en/articles/12414460-what-features-do-i-unlock-with-tarteel-premium>; App Store: <https://apps.apple.com/app/tarteel/id1391009396>
- Ayah, App Store: <https://apps.apple.com/se/app/ayah-quran-app/id706037876?l=en>
- Egypt install figures (reported): <https://42matters.com/most-popular-lifestyle-apps-egypt>
