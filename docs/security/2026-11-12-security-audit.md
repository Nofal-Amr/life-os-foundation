# Life OS pre-launch security audit

**Dates:** 12–13 November 2026
**Code audited:** `preview/all` at `e6c604e` (now merged to `main`), then `origin/main` at `c4f1e18`. The second pass adds Google Calendar sync (#23), Relationships (#24), notes realtime (#22), the plan importer (#25), and the find-my-phone and music-remote bridge (#21, #26).
**Method:** OWASP Top 10 (2025) as the checklist, the VibeSec secure-coding guide, and the `security-review` method: trace each input to where it is used, then drop anything that isn't a concrete, exploitable problem. The live database was checked read-only: the Supabase security advisor plus `SELECT`s on `pg_policies`, `pg_class`, `storage.buckets` and role grants. Nothing was written to it.

## Summary

| Rank     | Open                            | Fixed                                                |
| -------- | ------------------------------- | ---------------------------------------------------- |
| Critical | 0                               | 0                                                    |
| High     | 0                               | 2 (in #19) + 1 critical dependency advisory (in #19) |
| Medium   | 5 (one needs a database change) | 0                                                    |
| Low      | 14                              | 0                                                    |

The fundamentals are solid:

- Every table in the live database has row-level security, and every policy is tied to the signed-in user or to Together/Work membership.
- The `security definer` functions take no user id and act only for `auth.uid()`.
- The website runs a nonce-based script policy.
- No secrets are in the client bundle or the git history. Only the public Supabase key is.
- The new Google Calendar code is well built.

The work left before marketing is the five Medium items, mostly sign-in hardening for the phone apps and one storage setting.

**Verified** means I followed the code path end to end, or saw it in the live database. **Suspected** means the pattern is known to be exploitable, but I didn't reproduce it.

---

## Fixed in this audit (merged as #19)

### H1. Any link could sign the Android app into a stranger's account. Fixed. _Verified._

- **Evidence:**
  - `mobile/android/AndroidManifest.xml:84-89`: the exported `lifeos://auth-callback` filter.
  - `MainActivity.callbackUrl` (before the fix): loaded any `#access_token=…` straight into `/auth`.
  - `@supabase/auth-js` `GoTrueClient._getSessionFromURL` (flow type `implicit`): accepts any valid token pair found in the URL.
- **Exploit:** an attacker creates their own Life OS account and puts a link to `lifeos://auth-callback#access_token=<theirs>&refresh_token=<theirs>&…` on a web page or in a message. The victim taps it and their app is silently signed into the attacker's account. Everything the victim logs next (money, health, notes, prayer) goes to the attacker. Worse: if the attacker's account has a Life Connect key and the victim opens Settings, the victim's SIM phone starts relaying its SMS and calls to the attacker.
- **Fix:**
  - The new class `AuthCallbackGate.java` makes the app accept a sign-in result only within 30 minutes of the app itself opening Google sign-in (`/auth/v1/authorize` or `/auth?handoff=android`), and only once.
  - Wired in at `MainActivity.java` `callbackUrl` / `takeSignIn` / `shouldOverrideUrlLoading`.
  - Tests: `mobile/android/test/AuthCallbackGateTest.java`.

### H2. Life Connect forwarded one-time codes by default. Fixed. _Verified._

- **Evidence:** `ConnectConfig.java` `optBoolean("codes", true)` and `LifeConnectCard.tsx` `useState(true)` / `readLocal(CODES_KEY, "1")`, both before the fix.
- **Exploit:**
  - Bank and login OTPs went to a second device and into its Messages log.
  - Anyone holding the account's session (a stolen phone, or an XSS) can read `user_preferences.connect_key`. With it, they can follow the relay channel and get every OTP live. That is a direct path from a Life OS account to a bank account.
  - It also breaks the owner's rule "never read OTPs".
- **Fix:**
  - New `SmsFilter.java`, with `CODES_DEFAULT = false`.
  - The web default is now off (`forwardsOneTimeCodes` in `src/lib/native.ts`).
  - Forwarding codes is now a choice the user makes.
  - Tests: `mobile/android/test/SmsFilterTest.java`, `src/lib/lifeConnect.test.ts`.

### Dependencies (merged in #19)

- `shell-quote` critical advisory: fixed by override `^1.11.0`.
- `seroval` script and code injection (used in server-rendered pages): fixed by override `~1.6.12`.
- Also updated: `launch-editor`, `source-map-js`, and vitest `^5.0.3`.
- Checked: server-rendered pages still come out with a nonce and router data.

---

## Medium (open)

### M1. The `project-images` storage bucket is public, with no size or type limit. _Verified (live database)._

- **Evidence:**
  - `storage.buckets`: `project-images` has `public = true` and no `file_size_limit` or `allowed_mime_types`. It was created outside the repo. Its object policies are owner-only (`supabase/migrations/…_f9b11025….sql` lines with `project_images_*_own`).
  - The app already uses signed URLs (`src/data/projects.ts:39`), so public access is never needed.
  - The type and size checks happen only in the browser (`src/data/projects.ts:46-52`).
- **Exploit:**
  - Anyone who learns a cover's path (`<user id>/<project id>/cover-<time>.<ext>`) can read it forever, with no sign-in. Paths leak through shared screenshots, logs and old signed links.
  - Any user can bypass the app and upload any file type of any size to a public URL on the project's Supabase domain. That makes it free hosting for phishing pages or large files. _Suspected: depends on how Supabase serves HTML and SVG._
- **Fix:** needs your approval. This is a one-line database change and the app needs no code change:

```sql
-- Make project covers private, like avatars, and enforce the limits the app already shows.
update storage.buckets
set public = false,
    file_size_limit = 5242880,               -- 5 MB
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'project-images';
```

### M2. On the website, a link can sign a visitor into someone else's account (login CSRF). _Verified in library code, not reproduced live._

- **Evidence:** `src/integrations/supabase/client.ts:13-18` doesn't set `flowType`, so the default `implicit` applies. With `detectSessionInUrl`, any page load with `#access_token=…&refresh_token=…` replaces the current session (`GoTrueClient._getSessionFromURL`).
- **Exploit:** the same as H1, on the web. A link to `https://lifeos0.vercel.app/auth#access_token=<attacker>…` puts the victim in the attacker's account. If they don't notice, what they type next is the attacker's to read. It is less serious than H1 because Life Connect only runs in the app.
- **Fix:** no database change, but it changes how every sign-in finishes, so I didn't do it in this pass. It needs testing on a real phone.
  - Set `auth: { flowType: "pkce" }`. `client.ts` is Lovable-generated, so set it there or through Lovable.
  - The app's `/auth` page then calls `supabase.auth.setSession()` itself, only for the gated `lifeos://` hand-off.
  - Google's own button (`signInWithIdToken`) is unaffected.

### M3. Sign-in tokens go to the phone apps through custom URL schemes that any app can claim. _Suspected._

- **Evidence:**
  - `src/lib/googleIdentity.ts:92-110` (`handoffUrl`) and `src/routes/auth.tsx:82-86` put the full `access_token` and `refresh_token` in `lifeos://auth-callback#…` or `lifeosnative://auth-callback#…`.
  - The redirect flow does the same through Supabase (`auth.tsx`, `redirectTo: ANDROID_CALLBACK`).
- **Exploit:** a malicious app installed on the same phone registers `lifeos://` (or `lifeosnative://`). Android may route the link to it, or show a chooser the user taps wrongly. That app now holds a refresh token and has full, lasting access to the account.
- **Fix:**
  - Hand off a one-time code instead of the tokens, with a PKCE verifier the app created before opening the browser. The app swaps the code for a session, so an intercepted code is useless.
  - Better still, use an Android App Link (`https://lifeos0.vercel.app/app-callback`, verified with `/.well-known/assetlinks.json`) so no other app can claim it.
  - No database change needed.

### M4. The Android APKs given to people are debuggable and signed with a debug key. _Verified._

- **Evidence:**
  - `mobile/android/build.mjs:137` uses `--debug-mode` for every build, including `--full`, which makes the app `android:debuggable`.
  - `MainActivity.java:194-196` then turns on WebView debugging.
  - The signing key is `~/.android/debug.keystore` with password `android` (`build.mjs:183-229`).
- **Exploit:** anyone with the unlocked phone and a USB cable (repair shop, a family member, theft) can:
  - run `adb shell run-as app.lifeos` and copy the session, the Life Connect key and the SMS log;
  - or open `chrome://inspect` and drive the `LifeOSNative` bridge, for example to send SMS from the SIM phone.

  A debug key also can't safely sign Play Store builds or protect updates.

- **Fix:** add a release mode to `build.mjs`: no `--debug-mode`, and a real release key kept outside the repo. Use it for anything given to other people. Keep debug builds for the owner's own testing. The owner has to create the key.

### M5. The native Kotlin app accepts sign-in links it didn't ask for. _Verified; the app is paused and not shipped._

- **Evidence:** `mobile/native/app/src/main/java/app/lifeos/kt/MainActivity.kt:60-66` takes any `lifeosnative://auth-callback#…` (manifest line 35).
- **Exploit:** the same as H1, for the native app.
- **Fix:** port `AuthCallbackGate` before the native app ships: record when sign-in starts, and accept a result once within the time window. Fixing M3 (PKCE) removes the problem entirely.

---

## Low (open)

| #   | Finding                                                                                                 | Evidence                                                                | Fix                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Leaked-password protection is off                                                                       | Supabase advisor `auth_leaked_password_protection`                      | Dashboard → Auth → Passwords → turn on the leaked-password check.                                                                                  |
| L2  | Invite codes for Together and Work: 6 characters from `random()`, no attempt limit                      | `together.sql:162`, `work.sql:266`, `join_pod` / `join_work_org`        | Use `extensions.gen_random_bytes`, 8+ characters, and a per-user attempt counter. Low while there are few spaces.                                  |
| L3  | `anon` and `authenticated` hold `TRUNCATE`, `TRIGGER` and `REFERENCES` on every public table            | `information_schema.role_table_grants`                                  | Not reachable through the API (row-level security applies; PostgREST has no TRUNCATE). Optional SQL below.                                         |
| L4  | The web-view bridge is added to every frame, but `trusted()` checks only the main page's host           | `MainActivity.java:126`, `965`, `417`                                   | No iframes today. If one is ever added, check `getUrl()` on the UI thread, or use `WebViewCompat.addWebMessageListener` with an origin allow-list. |
| L5  | A few bridge methods skip `trusted()`: `canNotify`, `healthStatus`, `compassDeclination`, `stopCompass` | `MainActivity.java:956`, `961`, `1087`, `1124`                          | They only read state, but add `trusted()` for consistency.                                                                                         |
| L6  | Pages inside the APK carry no script policy (assets are served by `shouldInterceptRequest`)             | `MainActivity.openAsset`                                                | Add a strict CSP `<meta>` to the APK's `index.html`. The bridge turns any XSS there into SMS sending.                                              |
| L7  | The website doesn't send its own HSTS header                                                            | `src/lib/security-headers.ts:15`                                        | Vercel adds HSTS on `*.vercel.app`. Add `Strict-Transport-Security` before using a custom domain.                                                  |
| L8  | The exact GPS position is sent to BigDataCloud for a place name                                         | `src/data/spirit.ts:208`                                                | Round to 2 decimals (about 1 km) before sending, and name the service in the privacy page.                                                         |
| L9  | The on-device AI model downloads from Hugging Face `main`, not a pinned revision                        | `src/lib/localAi.ts:12`, `51`                                           | Pin a commit or revision so the file can't change under users. It runs sandboxed in WebAssembly.                                                   |
| L10 | Work clock-in trust fields are set by the phone (`verified`, `mock`, coordinates)                       | `work.sql:58-63`                                                        | Expected for a phone app. Tell admins that location is "as reported by the phone".                                                                 |
| L11 | Native app tokens sit in plain DataStore                                                                | `SessionStore.kt:69-70`                                                 | `allowBackup="false"` already. Wrap them with an Android Keystore key before launch.                                                               |
| L12 | Life Connect keeps running after sign-out (its key and role stay on the phone)                          | `useAuth.tsx:63`, `ConnectConfig`                                       | On sign-out, call `lifeConnect.configure({ role: "off" })` and clear `ConnectLog`.                                                                 |
| L13 | Dev and build tooling advisories (brace-expansion, minimatch, Vite 8.1.5 dev server); Zod 3 memory DoS  | `bun audit`: 6 high, 6 moderate, 1 low, none in shipped code except Zod | Upgrade Vite past 8.1.5 and ESLint deps when convenient. Zod 4 is a bigger upgrade; the server inputs already cap lengths.                         |
| L14 | Relationships policies have no `TO authenticated` (they apply to every role)                            | `relationships.sql:77-100`                                              | Harmless (`auth.uid()` is null for anon). Add `TO authenticated` next time this file changes.                                                      |

Optional hardening SQL for L3, for the owner's approval (not needed for launch):

```sql
-- PostgREST never needs these; table access stays exactly as today.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
```

---

## New code reviewed in the second pass: no issues found

- **Google Calendar (#23):**
  - The OAuth `state` is HMAC-signed, tied to the user and expires in 10 minutes. PKCE S256 keeps the verifier in `sessionStorage`.
  - The refresh token is sealed with AES-256-GCM, using the user id as associated data, so it can't be swapped between accounts.
  - Only minimal scopes are requested.
  - Every server function uses `requireSupabaseAuth` and the user's own token, so row-level security applies. There is no service-role use.
  - Its tables aren't in production yet. The migration's policies are owner-only.
- **Relationships (#24):** live in production. Row-level security is on, and every link, interaction and rule must point at your own people.
- **Notes realtime (#22):** the subscription is filtered by `user_id` and Realtime enforces row-level security. It only triggers a re-read. The migration isn't applied yet.
- **Plan importer (#25):** Markdown is parsed to plain text, rendered by React without HTML, and saved through the normal data layer.
- **Find my phone and music remote (#21, #26):**
  - Bridge methods check `trusted()` and allow-list their actions.
  - Relay messages are sealed with AES-GCM, expire after 90 seconds and are de-duplicated.
  - Notification intents are explicit and immutable.

## Verified as good

- Row-level security is on for all public tables in production. No policy is `true`, and none is open to anon.
- The 13 `security definer` functions use `search_path = ''`, take no user id, are revoked from `anon`, and answer only for `auth.uid()`. The advisor warnings about them are expected.
- `delete_my_account` deletes only the caller's rows.
- The `avatars` bucket is private, with size and type limits and per-user folders.
- The website's script policy is nonce-based with `strict-dynamic`. It also sets `frame-ancestors 'none'`, `nosniff`, `X-Frame-Options DENY`, a strict referrer policy and a narrow permissions policy.
- No `dangerouslySetInnerHTML` except the stock shadcn chart style. No `eval`, no open redirects, no redirect parameters.
- No secrets in the bundle or git history. `.env` holds only public values. The service-role client is server-only and unused by the app.
- The offline cache and outbox are keyed per user, and sign-out clears them.
- The Android manifest exports only the launcher activity, the Health Connect alias (permission-guarded), the SMS receiver (`BROADCAST_SMS`) and the notification listener (`BIND_NOTIFICATION_LISTENER_SERVICE`). The file provider isn't exported. `allowBackup="false"`.
- The WebView has file and content access off, camera and microphone requests denied, and external links sent to the browser.
- `saveFile` limits file types, cleans file names and caps the size.
- Life Connect: a 256-bit key, a derived channel name, AES-GCM, a 90-second freshness window and replay protection.
- Auto-spending reads only the bank apps the user ticks. The wear app holds no account data.

## What I could not check

- **Supabase Auth settings:** email confirmation, minimum password length, the redirect URL allow-list, rate limits. These live in the dashboard, which I'm not allowed to use.
- **Vercel:** environment variables, headers and HSTS on the live domain, and the deploy-blocking rules.
- **Real phones:** H1 and H2 were checked by unit tests and a full APK build, not on a device. M3 interception wasn't tried.
- **Browser hydration after the `seroval` upgrade:** I checked the server output. The browser pane refused the local page. #19's headless demo reportedly covered this, but I didn't see it run.
- **How Supabase serves HTML and SVG from a public bucket** (M1's second half).
- **Elsewhere:** the iOS app, GitHub release files, and the Google Cloud OAuth client settings (redirect URIs, consent screen).

## What needs the owner

1. **Approve the M1 SQL** (make `project-images` private). This is the only database change that matters for launch.
2. **Turn on leaked-password protection** in the Supabase dashboard (L1).
3. **Create a release signing key** (M4), so I or another session can add a release build.
4. **Decide on M2 and M3** (PKCE sign-in for web and app). I recommend doing them together in one branch, tested on a phone.
