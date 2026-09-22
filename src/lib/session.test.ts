import { describe, expect, it } from "vitest";

import { storedUser } from "./session";

const storage = (entries: Record<string, string>) => ({
  length: Object.keys(entries).length,
  key: (i: number) => Object.keys(entries)[i] ?? null,
  getItem: (key: string) => entries[key] ?? null,
});

describe("storedUser", () => {
  it("reads the user from Supabase's stored session", () => {
    const user = storedUser(
      storage({
        theme: "dark",
        "sb-abc-auth-token": JSON.stringify({ access_token: "x", user: { id: "u1", email: "a@b.c" } }),
      }),
    );
    expect(user?.id).toBe("u1");
  });

  it("is null when there is no session or it is corrupt", () => {
    expect(storedUser(storage({}))).toBeNull();
    expect(storedUser(storage({ "sb-abc-auth-token": "{not json" }))).toBeNull();
    expect(storedUser(storage({ "sb-abc-auth-token": JSON.stringify({ user: {} }) }))).toBeNull();
    expect(storedUser(null)).toBeNull();
  });
});
