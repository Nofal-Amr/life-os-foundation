import { describe, expect, it } from "vitest";

import { calls, conversations, thread } from "./connectLog";
import type { ConnectLogEntry } from "@/lib/native";

const log: ConnectLogEntry[] = [
  { kind: "sms", at: 1, number: "+201001234567", name: "Mona", body: "Are you coming?" },
  { kind: "sent", at: 2, number: "+201001234567", name: "Mona", body: "On my way", ok: true },
  { kind: "sms", at: 3, number: "VODAFONE", name: "", body: "Your balance is…" },
  { kind: "call", at: 4, number: "+201001234567", name: "Mona", call: "c1", outcome: "missed" },
  { kind: "sms", at: 5, number: "+20 100 123 4567", name: "", body: "Call me" },
];

describe("connectLog", () => {
  it("groups messages by person, newest first, keeping the contact name", () => {
    const rows = conversations(log);
    expect(rows.map((row) => row.name)).toEqual(["Mona", "VODAFONE"]);
    expect(rows[0]?.count).toBe(3);
    expect(rows[0]?.last.body).toBe("Call me");
  });

  it("shows one person's thread oldest first, without calls", () => {
    expect(thread(log, "+201001234567").map((entry) => entry.body)).toEqual([
      "Are you coming?",
      "On my way",
      "Call me",
    ]);
  });

  it("lists calls on their own", () => {
    expect(calls(log).map((entry) => entry.outcome)).toEqual(["missed"]);
  });
});
