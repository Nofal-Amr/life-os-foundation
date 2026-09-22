import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end checks of the signed-out app (the intro page and sign-in),
 * run against the dev server. Signed-in screens need a real account, so
 * they are covered by unit tests of their data instead.
 *
 * Uses the installed Chrome, so no browser download is needed:
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  // *.e2e.ts, so Vitest (which picks up *.spec.ts / *.test.ts) never runs these.
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  reporter: [["list"]],
  // The dev server compiles each page on first visit, which can take a few seconds.
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:5173",
    channel: "chrome",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
