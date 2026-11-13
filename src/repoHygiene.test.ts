import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/** Committed files matching the given paths or patterns. */
function tracked(...paths: string[]): string[] {
  return execFileSync("git", ["ls-files", "--", ...paths], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

// Audit finding S13: hook scripts that ran a third-party program on every agent edit, and a
// compiled binary, were committed by accident. These keep them from coming back.
describe("repository hygiene", () => {
  it("has no committed agent hooks", () => {
    expect(tracked(".claude/settings.local.json", ".codex")).toEqual([]);
  });

  it("has no committed third-party agent skills", () => {
    expect(tracked(".agents", ".claude/skills", "skills-lock.json")).toEqual([]);
    expect(tracked(".claude/agents").filter((file) => file.includes("impeccable"))).toEqual([]);
  });

  it("has no committed executables", () => {
    expect(tracked("*.exe", "*.dll", "*.so", "*.dylib")).toEqual([]);
  });
});
