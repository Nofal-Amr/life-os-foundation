import { expect, test, type Page } from "@playwright/test";

/** Collects console errors and uncaught page errors for the whole test. */
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("intro page (signed out)", () => {
  test("shows the pitch and a single primary action", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /Your day, money, body and prayers/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
    await expect(page).toHaveTitle(/Life OS/);
    expect(errors).toEqual([]);
  });

  test("the section picker switches panels by click and by arrow keys", async ({ page }) => {
    await page.goto("/");
    const tabs = page.getByRole("tablist", { name: "Sections of Life OS" });
    const panel = page.getByRole("tabpanel");

    await expect(tabs.getByRole("tab", { name: "Today" })).toHaveAttribute("aria-selected", "true");
    await expect(panel.getByRole("heading")).toHaveText("One next step, not a wall of lists");

    await tabs.getByRole("tab", { name: "Money" }).click();
    await expect(panel.getByRole("heading")).toHaveText("What you can still spend before payday");

    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: "Body" })).toBeFocused();
    await expect(tabs.getByRole("tab", { name: "Body" })).toHaveAttribute("aria-selected", "true");

    // Wraps around from the last tab to the first.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: "Today" })).toHaveAttribute("aria-selected", "true");
  });

  test("Get started opens the sign-up form", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Get started" }).first().click();

    await expect(page).toHaveURL(/\/auth\?mode=signup/);
    await expect(page.getByRole("tab", { name: "Sign up" })).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
    // New passwords need 8+ characters.
    await expect(page.getByLabel("Password")).toHaveAttribute("minlength", "8");
  });

  test("never scrolls sideways", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("sign-in page", () => {
  test("sign-in does not force the new-password minimum on existing accounts", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("tab", { name: "Sign in" })).toHaveAttribute("data-state", "active");
    await expect(page.getByLabel("Password")).not.toHaveAttribute("minlength", /.*/);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  test("the title links back to the intro page", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("link", { name: "Life OS" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("protected pages", () => {
  for (const path of ["/dashboard", "/finance", "/health", "/notes", "/settings"]) {
    test(`${path} sends a signed-out visitor to sign in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/auth/);
    });
  }
});
