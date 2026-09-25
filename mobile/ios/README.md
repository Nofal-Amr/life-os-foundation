# Life OS for iPhone

A native shell around the live web app (lifeos0.vercel.app), like the Android
app, with the phone-only parts done natively:

- **Sign-in**: Google and other providers run in the system sign-in sheet
  (Google doesn't allow sign-in inside web views) and come back through
  `lifeos://auth-callback`, the same address the Android app uses.
- **Notifications**: prayer, task and your own reminders are scheduled as
  local notifications from the same list the Android app gets (the soonest 60;
  iOS keeps 64 at most). Tapping one opens its page.
- **Exports**: "Export to Excel" opens the share sheet (Save to Files).
- **Offline**: the site is an app-bound domain, so its service worker works
  inside the app and pages open without a connection.
- The site recognises the app by `LifeOSiOS` in the user agent.

Not yet: Apple Health (HealthKit), widgets, and the Live Activity for timers.

## Build and run (needs a Mac with Xcode 26)

```sh
brew install xcodegen
cd mobile/ios
xcodegen generate
open LifeOS.xcodeproj
```

In Xcode: select the LifeOS target → Signing & Capabilities → pick your team
(a free Apple ID works for your own phone), then Run on your iPhone.

Every change under `mobile/ios/` is also compiled on GitHub's Macs by
`.github/workflows/ios.yml`, without signing.

## Putting it on the App Store

Needs an Apple Developer account (99 USD a year): archive in Xcode, upload,
then submit in App Store Connect. Apple reviews apps that wrap a website more
strictly, so the native parts above matter.
