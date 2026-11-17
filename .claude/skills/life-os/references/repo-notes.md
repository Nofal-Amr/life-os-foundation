# Repo notes (practical)

## Layout

- **Main checkout:** `C:\Users\ASUS 030T\life-os-foundation`, on the `at-a-glance` branch, which must not change. Do the work in worktrees:
  - `../lo-ux`: `preview/all`, the combined preview, with a dev server on port 5175;
  - `../lo-dev` and `../lo-build`;
  - `.claude/worktrees/*`.

  `node_modules` is linked to the main checkout.

- **Branching:** every change branches from `origin/main` and goes through its own pull request. `preview/all` is old; don't use it.
- **Web:** TanStack Start and Router, React, Vite, Tailwind v4, shadcn/Radix, and Supabase through the offline wrapper in `src/lib/offline.ts`.
  - Demo mode is localStorage `lifeos:demo`=`1`; offline mode is off in demo.
  - The production CSP uses nonces, so don't add inline scripts.
- **Android:**
  - `mobile/android`: the Java web-view app (`app.lifeos`). Its JS bridge is `LifeOSNative`, in `MainActivity.java`. Build with `npm run build:android` and test with `npm run test:android`.
  - `mobile/native`: Kotlin and Compose (`app.lifeos.kt`). Build with `npm run build:native`.
  - `mobile/wear`: Wear OS. Build with `npm run build:wear`. It needs the `JAVA_TOOL_OPTIONS` tmpdir workaround, which `build.mjs` sets.
- **Database:** Supabase project `albrfuugjiimogrtepql`. It is read-only for agents; see the safety rules.

## Gotchas

- **Never run `git worktree remove --force` on a worktree whose `node_modules` is a junction.** It follows the junction and empties the shared `node_modules` that every worktree uses; this happened on 2026-11-12. Delete the junction first, in PowerShell: `[System.IO.Directory]::Delete("<wt>\node_modules", $false)`, which removes only the link. Then check that `Test-Path <wt>\node_modules` is False before removing the worktree. Don't use `cmd //c rmdir` from Git Bash: its quoting fails silently, and the shared modules were wiped twice on 2026-11-12/13. Better still, create scratch worktrees under `.claude/worktrees/`, which need no junction because packages resolve through the parent folder. To repair: `bun install --frozen-lockfile` in the main checkout, then in any worktree with extra dependencies.
- **Worktrees under `.claude/worktrees/`** find packages through the parent folder's `node_modules`.
- **Line endings:** `core.autocrlf=true`, so files in worktrees are CRLF. Scripted string replacements must convert `\n` to `\r\n`, or use the Edit tool.
- **Python** is `py -3` on this PC; Node works for scripts too.
- **Headless browser checks:** Playwright with `chromium.launch({ channel: "msedge" })`, with the script run from inside the worktree so it resolves `playwright`.
- **Production build check:** `NITRO_PRESET=node-server npm run build`, then `PORT=5180 node .output/server/index.mjs`.
- **Emulator:**
  - The AVD is `Pixel_8_Pro_API_35`, and adb is at `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`.
  - Use `adb emu geo fix <lon> <lat>` for location (Cairo: `31.2357 30.0444`).
  - Shrink screenshots before reading them.
- **Vercel deploy failures across all code** usually mean a dependency CVE block; bump the flagged package. Keep the bun minimum release age of one day in mind.
