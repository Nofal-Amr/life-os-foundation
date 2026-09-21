// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// LIFE_OS_MOBILE=1 builds a static single-page bundle for the Android app
// (mobile/android). The web build is unchanged when the flag is absent.
const mobile = process.env["LIFE_OS_MOBILE"] === "1";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(mobile
      ? { spa: { enabled: true, prerender: { outputPath: "/index.html", crawlLinks: false } } }
      : {}),
  },
  ...(mobile ? { nitro: false as const } : {}),
});
