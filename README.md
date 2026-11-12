# Life OS

A multi-user life-management product: tasks, projects, goals, habits, notes, calendar, money,
health, study, work and shared spaces. Data and sign-in are on Supabase, with row-level security
on every table.

## What is in this repository

| Path              | What it is                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `src/`            | The web app: TanStack Start, React 19, TypeScript, Tailwind 4.                                           |
| `mobile/native/`  | The native Android app (`app.lifeos.kt`): Kotlin and Jetpack Compose. This is the long-term Android app. |
| `mobile/android/` | The older Android app (`app.lifeos`), which shows the web app in a WebView. Security fixes only.         |
| `mobile/wear/`    | The Wear OS app.                                                                                         |
| `mobile/ios/`     | The iPhone shell.                                                                                        |
| `supabase/`       | Database migrations and SQL checks.                                                                      |
| `e2e/`            | Playwright checks of the signed-out pages.                                                               |
| `docs/`           | Specification (a roadmap of future features), audits and research.                                       |

## Working on the web app

You need Node.js and [Bun](https://bun.sh). `bun.lock` is the lockfile.

```sh
bun install
bun run dev
```

Build-time settings are read from `.env`; `.env.example` lists the optional ones.

| Command            | What it does                                               |
| ------------------ | ---------------------------------------------------------- |
| `bun run dev`      | Starts the development server.                             |
| `bun run build`    | Builds the web app.                                        |
| `bun run lint`     | Runs ESLint, which includes the Prettier formatting check. |
| `bun run format`   | Formats the code with Prettier.                            |
| `bun run test`     | Runs the unit tests (Vitest).                              |
| `npx tsc --noEmit` | Type-checks the code.                                      |
| `bun run test:e2e` | Runs the Playwright checks. Needs Chrome installed.        |

## Working on the Android apps

Both need a JDK 17 and the Android SDK.

| Command                 | What it does                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run build:native`  | Runs the native app's unit tests and builds it. Needs Gradle 8.11.1, which Android Studio downloads when the project is first opened. |
| `bun run build:android` | Builds the WebView app with the SDK command-line tools.                                                                               |
| `bun run test:android`  | Runs the WebView app's plain-Java tests.                                                                                              |
| `bun run build:wear`    | Builds the Wear OS app.                                                                                                               |

## Changes

Work goes through pull requests into `main`. Every merge to `main` deploys to
https://lifeos0.vercel.app through Vercel. Agents working in this repository follow `AGENTS.md`.
