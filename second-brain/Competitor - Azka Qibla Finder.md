---
tags: [research, competitor, spirit]
updated: 2026-11-12
---

# Competitor: Azka Qibla Finder (a friend's app)

The owner sent a friend's APK (`app-release (1).apk`, 67 MB, from Google Drive) as input for the prayer and azkar benchmark. It was **read without being run**: manifest, config, and the text inside the JavaScript bundle. It was not installed anywhere. These are the friend's ideas, so learn from them and don't copy their art, text or branding. See [[Handoff - next session]].

## What it is
- Package `com.hajjumrah.ar`, version 1.0.0, Android 6+ (target 14). It is an Expo / React Native app (Hermes engine).
- Brand colour is a deep teal (#0A3D3B / #0F7C75), with light and dark modes.
- It is offered in about 9 languages: Arabic, English, French, Spanish, German, Indonesian, Malay, Swahili and Turkish. Its own text says the translations were "made with machine help, awaiting native review".
- It has **no account and no server**. Everything stays on the phone, there is an "Erase all app data" option, and a data-deletion request is supported.

## Screens and features
- **Prayer times:**
  - Calculation methods include Egyptian General Authority, Karachi, ISNA, MWL, Makkah (Umm al-Qura) and Tehran, plus a Shafi or Hanafi choice for Asr.
  - You set the location by searching for a city or by GPS.
  - **Offline city packs:** you can "Download a country's cities so prayer times work with no connection at all".
- **Adhan:**
  - Two built-in calls (normal and fast). You can preview them at any speed, or pick any audio file on the phone as your own adhan.
  - It handles Android's rule that a notification channel keeps a fixed sound.
  - It uses exact alarms and resets them after the phone reboots.
- **Qibla:** a compass with the Kaaba on a marker ("hold your phone flat and turn until the Kaaba reaches the marker at the top").
- **Azkar:** sets for morning, evening, waking and after prayer.
  - You tap the card to count repetitions.
  - Transliteration can be turned on or off.
  - Morning and evening azkar have daily reminders.
- **Tasbeeh:** a counter with a "reset to zero?" confirmation.
- **Quran:** a reader with surah search and juz. Its note says "translations convey the meaning only".
- **Four home-screen widgets:** Next prayer, Prayer times, Overview, and Qibla.
- **Appearance:**
  - colour palette, dark mode, font size and button size;
  - a configurable "frame", meaning the border thickness on each side and how round the inner corners are.
- **Free version and Premium:** "Premium removes ads". Premium also gives custom adhan and similar extras, and "Quran and Azkar keep working" on the free version.
  - Ads use Google Mobile Ads with Google's own **test** app ID, so it isn't earning money yet.
  - There is a consent screen.
  - An in-app switch turns premium on for testing.

## Things worth noting
- Permissions include ACTIVITY_RECOGNITION and the advertising ID, which a prayer app doesn't need. Most likely they come in with Google Play services and the ads SDK.
- Background location, microphone, camera and storage are all explicitly blocked, which is good privacy hygiene.

## What Life OS can learn (principles, not copying)
1. **Prayer times must work fully offline,** including a first run with no internet. Life OS currently needs a location fetch.
2. **Let the user pick the calculation method and Asr school,** defaulting to Egyptian for Egypt.
3. **Make adhan a real alarm,** with a choice of sound and its own sound. On the web that's limited; it fits the native app.
4. **Add a waking and after-prayer azkar set,** a tap-to-count card, transliteration on or off, and gentle morning and evening reminders.
5. **Home-screen widgets:** next prayer and Qibla are the ones people use. These go in the native app; see the widgets table in the native spec.
6. **Keep the privacy story simple:** "no account needed for faith features" is a strong message.

## Hands-on test on the emulator (2026-11-12)
I installed it on the Pixel 8 Pro emulator with the owner's OK, then uninstalled it. Location was set to Cairo.

**A crash bug to tell the friend about:** the x86/x86_64 builds are missing `libexpo-av.so`. The app crashes on launch on x86 devices: Chromebooks, emulators and some tablets. Forcing the ARM build works.

### The flow
1. On first launch, the location permission pops up straight away, with no explanation first.
2. Behind it is a **Premium sheet**, "Welcome… start free or turn on Premium". It lists 14 languages, colour palettes, azkar with reminders, tasbeeh counter, offline places and no ads. The choices are "Turn on Premium" and "Continue free".
3. **Five tabs** in this order, starting from the right: Qibla (the home tab), Prayer, Quran, Azkar, Settings. It is dark teal and gold with a gold frame around the screen, and Arabic-first RTL is done well.
4. **An offline banner** sits on every screen: "you're offline; Qibla, times, Quran and azkar work as they are."

### Screens
- **Prayer:**
  - The header has the Gregorian date and the Hijri date, and a city card with a "Change" button.
  - A **hero card** shows the next prayer, a countdown ("in 41:02") and a **progress bar from the last prayer to the next**.
  - Below it is the list of six times, with the next one tagged.
  - A banner ad sits under the list.
- **Location:** city search (it found Cairo, Egypt first) or GPS.
- **Qibla:** a compass dial with N/E/S/W, degrees, and the Kaaba icon on an arrow. It also shows the **distance to the Kaaba (1,286 km)** and "degrees from true north", with a figure-8 calibration hint.
- **Quran:**
  - Surahs and juz tabs, with a search box.
  - Each row shows the surah number, its name in Arabic and transliteration, Meccan or Medinan, and the number of ayahs.
  - The reader shows the basmala, then one card per ayah. Text is from tanzil.net under CC BY.
- **Azkar:**
  - Categories are Morning, Evening, After prayer, Before sleep and On waking. They sit in **two segmented rows**, and one item in each row looks selected at once, which is confusing.
  - Toggles for "Show meaning" and "Show transliteration".
  - Each card has the Arabic, the transliteration in gold italics, the meaning, the source (e.g. Bukhari, Muslim; Qur'an 2:255) and a count chip ("once", "0 / 100"). **Tapping the card counts.**
  - The count **reset to 0** after switching tabs.
- **Settings:** one very long scroll of cards.
  1. Premium switch, with a red warning that it is a test key and Google Play billing must be connected before publishing.
  2. Language: 14 inline radio rows, 12 of them locked.
  3. Appearance: light, dark or system, plus 5 palettes, 4 of them locked.
  4. Notifications on or off. Alert sound: adhan, fast adhan, phone default or silent.
  5. An adhan "Try listening" button, playback speed, and your own adhan file (locked).
  6. Azkar reminders (locked) and offline places (locked).
  7. Outer frame: 4 sliders and a "same width on all sides" switch.
  8. Text size and button size sliders.
  9. Calculation method (**default Umm al-Qura**) and Asr school.
  10. Privacy policy and terms, then support by email.
  11. Your data: "everything stays on this phone, no account or server", plus Delete my data and Request account deletion.
  12. About: version, Full edition, the Quran text credit. Then Reset to defaults.

### What the paid plan includes
- **Free:** Qibla, prayer times, Quran, reading azkar, Arabic and English, one palette, with ads.
- **Premium:** no ads, 12 more languages, 4 palettes, tasbeeh counter, azkar reminders, offline city packs and your own adhan file.
- **No price or billing yet.** A test switch turns it on.
- **Judgement:** the free version is generous with content. But it charges for **worship habits** (tasbeeh, azkar reminders), puts **ads under prayer times**, and shows the **paywall before you've seen anything useful**. Many Muslim users push back on all three. Themes and languages are weak things to charge for.

### UX problems found
1. The permission and paywall arrive before the app has shown any value.
2. **Wrong default for Egypt:** Umm al-Qura even when the city is Cairo. Isha shows 6:30 PM against about 6:20 with the Egyptian method, and Fajr is off by about 6 minutes.
3. The home tab is the Qibla, which stays on "locating…" while GPS is slow. The next prayer is the more useful first screen.
4. Two segmented rows for one choice, and the azkar count isn't kept.
5. Settings is one endless page. The 14 languages and 4 frame sliders should be sub-pages.
6. Developer warnings (the test key) are visible to users.

## What Life OS takes from it (principles)
Life OS Spirit already has calculation methods (Egyptian, Umm al-Qura, Karachi, ISNA…), a Hanafi option, the Hijri date, Kaaba distance and a calibration hint.

**Worth adding:**
1. A **next-prayer countdown with a progress bar since the last prayer**, on the Today Prayer tile and in Spirit.
2. An **azkar card format**: Arabic, transliteration toggle, meaning, source and a count chip, with tap to count. **Keep the count for the day** (they lose it).
3. **One clear category picker** for azkar, including On waking and Before sleep.
4. An **offline note that says what still works**, instead of a generic "offline" message.
5. A **privacy card in Settings**: what is stored where, delete my data, restore defaults, support contact.
6. **Pick the calculation method from the country automatically** (Egypt means Egyptian), with a one-line "why".

**Beat them on:**
- no paywall or ads on worship, ever;
- the first screen shows the next prayer, not a spinner;
- permissions are asked only when needed, with a reason;
- settings are short, with "More" sub-pages.

**Life OS monetisation idea (owner to decide):** if there is ever a paid plan, charge for Life OS power features (multi-device sync, export, AI reading of receipts or photos, Life Connect), never for faith basics.

## Where Life OS can be better
- **Prayer sits inside the day:** prayer times anchor the Today timeline and tasks (no other app does this).
- **Prayer tracking stays calm:** no streak pressure.
- **One app** covers money, tasks and faith together.
- **No ads, ever,** in faith features.
