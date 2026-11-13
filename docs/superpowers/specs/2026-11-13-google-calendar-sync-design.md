# Google Calendar sync: design

Date: 2026-11-13. Status: built behind "Not set up yet". It switches on once the owner creates
the Google OAuth client and approves the database change below.

## What the person gets

- In **Settings → Google Calendar** or on the **Calendar** page: "Connect Google Calendar".
- After Google's consent screen, they pick:
  - which Google calendars to show in Life OS (default: their main one);
  - which one new Life OS events go to (default: their main one, or "none" for read-only).

  Nothing syncs until they press "Start syncing".
- **Two-way sync of events.**
  - Events from the chosen calendars appear in Life OS as ordinary events.
  - Events made, edited or deleted in Life OS go to Google.
  - Edits made in Google come back.
- **When it syncs:** each time the Calendar page opens (if the last sync was more than 10 minutes
  ago), and when the person taps "Sync now". There are no webhooks: Google push channels need a
  public HTTPS endpoint that is renewed every week, plus a job queue. A pull on open is enough for
  one person's calendar and costs nothing on Vercel.
- **Disconnect.** It revokes Life OS's access at Google and forgets the tokens. The person
  chooses one of two things:
  - **Keep the copied events** (the default): they stay as normal Life OS events.
  - **Remove the events copied from Google:** only events that came *from* Google. Events the
    person made in Life OS always stay.

## Not in this version (later, if the owner wants it)

- **Tasks with a due time in a "Life OS" calendar.** Tasks only have a `due_date`, a day with no
  time, so they would all be all-day events and would crowd the Google calendar. Add it once tasks
  can carry a time, as a one-way push into a calendar called "Life OS" that is created on demand.
- **Recurring-series editing.** Google sends each repeat as its own occurrence
  (`singleEvents=true`), so editing one in Life OS changes that occurrence only. Editing the whole
  series stays in Google.

## Security and privacy

- **Scopes:** `calendar.events` (read and write events) plus `calendar.calendarlist.readonly` (the
  names of calendars for the picker), and `openid email` to show which account is connected.
  - Life OS never asks for full `calendar` access.
  - `calendarlist.readonly` is narrower than `calendar.readonly`, which would also allow reading
    every calendar's settings and sharing.
- **Tokens stay on the server.**
  - The OAuth code is exchanged on the server with the client secret.
  - The refresh token is encrypted with AES-256-GCM using `GOOGLE_TOKEN_KEY`, a server-only
    environment variable. The user id is the associated data, so a stored token can't be moved to
    another account.
  - Access tokens are never stored: each sync gets a fresh one and drops it.
  - The browser never sees a token. It sees only the account email, the calendar names and the
    last sync time.
- **The flow is tied to the browser and the account that started it.**
  - The `state` is HMAC-signed and carries the user id, a random nonce and a 10-minute expiry.
  - PKCE (S256): the verifier stays in that tab's `sessionStorage`.
  - Google's callback lands on a Life OS page. That page sends the code, the state and the verifier
    to a signed-in server function. The server checks that the state's user is the signed-in user,
    so a code stolen from the URL is useless.
- **Database:** two new tables. Row-level security means each person reaches only their own rows
  (see the migration).
- **Privacy page:** a section says plainly what is read, what is written, where tokens live, and
  how to disconnect.
- **Demo mode** never calls Google. It shows "Not set up yet".

## How sync works (`src/data/googleSync/`)

The engine is plain TypeScript. Google and the database are passed in as interfaces, so the whole
thing is unit-tested against a fake Google.

**Per chosen calendar**

1. **Pull.**
   - The first time: `events.list` with `singleEvents=true` and `timeMin` set to 30 days ago.
     Every page is read, and the final page's `nextSyncToken` is saved.
   - After that: `events.list?syncToken=…`, which returns only what changed.
   - **410 Gone** (the token expired): the saved token is dropped and a full pull runs again.
2. **For each Google event:**
   - **Cancelled:** delete the linked Life OS event, if there is one.
   - **New:** create a Life OS event and a link row (`origin = google`).
   - **Linked and changed** (the etag differs): apply the conflict rule.
3. **Push, but only to the calendar chosen for new events:**
   - A Life OS event changed since the last sync (`updated_at` is later than the link's
     `lifeos_synced_at`): patch it in Google, with `If-Match: etag`. A 412 response means Google
     changed it too, so the conflict rule decides.
   - A Life OS event with no link, starting within the window (30 days ago onwards): insert it
     into Google, then add a link (`origin = lifeos`).
   - A link whose Life OS event was deleted (`event_id` set to null by the foreign key): delete it
     in Google, then drop the link.

**Conflict rule**

When both sides changed since the last sync, **the most recent edit wins**: Google's `updated`
against Life OS's `updated_at`. On a tie, Google wins. It is simple, predictable and easy to
explain, and nothing is merged field by field.

**Read-only calendars**

On calendars the person can only read (a shared holiday calendar, for example), Life OS never
pushes. Google's copy wins on the next change.

**Mapping**

| Google | Life OS `events` |
|---|---|
| `summary` (empty → "(No title)") | `title` |
| `description` | `description` |
| `start.dateTime` / `end.dateTime` | `start_at` / `end_at` |
| `start.date` (all-day) | `start_at` = local midnight in the calendar's time zone; `end_at` = 23:59 of the last day (Google's end date is exclusive) |

A Life OS event with no end goes to Google with an end one hour after the start, because Google
requires an end.

## Server pieces

- **Server functions** (`src/lib/googleCalendar.functions.ts`). They all need the user signed in
  (`requireSupabaseAuth`), and every database call uses the user's own token, so row-level
  security applies. No service-role key is needed.
  - `status`
  - `startConnect`
  - `finishConnect`
  - `listCalendars`
  - `saveChoice`
  - `syncNow`
  - `disconnect`
- **Callback page:** `/google-calendar/callback`.
- **Environment variables (Vercel, server only):**
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_TOKEN_KEY` (32 random bytes, base64)
  - `GOOGLE_REDIRECT_URI` (optional; the default is `https://lifeos0.vercel.app/google-calendar/callback`)

  If any required variable is missing, `status` returns `configured: false` and the UI shows "Not
  set up yet".

## Database change (needs the owner's approval; not applied)

`supabase/migrations/20261113120000_google_calendar_sync.sql`

- **`google_calendar_connections`:** one row per person. It holds:
  - the account email;
  - the encrypted refresh token;
  - the granted scopes;
  - the chosen calendars;
  - the sync tokens per calendar;
  - the last sync time, and the last error in plain words.
- **`google_event_links`:** one row per synced event. It holds:
  - `event_id`, which is set to null when the Life OS event is deleted;
  - the calendar id;
  - the Google event id and its etag;
  - Google's `updated` time;
  - `lifeos_synced_at`, all-day or not, and `origin`.

Both tables: RLS on, owner-only select, insert, update and delete. Rows are removed with the
account (`on delete cascade`).
