The Life OS website is live at https://lifeos0.vercel.app, deployed by Vercel automatically on every push to `main` of github.com/Nofal-Amr/life-os-foundation (GitHub "Production" deployments). The user corrected me: it is not updated through Lovable, even though README/AGENTS.md and `.lovable/` still mention Lovable.

Traps: the repo's GitHub homepage `life-os-foundation-rouge.vercel.app` returns DEPLOYMENT_NOT_FOUND; per-deployment `*-nofal-amr.vercel.app` URLs sit behind Vercel login; `life-os-foundation.vercel.app` is someone else's site. Verify deploys by opening lifeos0.vercel.app.

Related: [supabase-access](supabase-access.md)

APKs: owner approved (2026-10-08) publishing them as a GitHub prerelease on the public repo — tag android-2026-10-08, refresh with `gh release upload android-2026-10-08 <apks> --clobber`. Two builds: life-os-debug.apk (standard, installs from WhatsApp) and life-os-full.apk (SMS + notification listener; Play Protect blocks sideloading it, install via adb). SendUserFile upload times out for ~10 MB APKs.

Vercel blocks deploys whose dependencies have known CVEs (build log: "Build cache cleared after a dependency security block"). That broke every deploy 8–15 Oct 2026 (@tanstack/react-start 1.168.32, CVE-2026-102989); fixed by bumping to 1.169.1 (commit 64ca794). If deploys fail again for all code, suspect this first and ask the owner for the build log. bun has minimum-release-age 1 day, so pick versions at least a day old. The Vercel connector is signed into another account, so it can't read these logs.
