import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { reminderNotifications, upcomingTimes, type UserReminder } from "./userReminders";

const at = (iso: string) => new Date(iso);
const reminder = (over: Partial<UserReminder>) =>
  ({
    id: "r1",
    title: "Call the bank",
    note: null,
    remind_at: "2026-09-25T15:00:00",
    repeat: "none",
    done_at: null,
    ...over,
  }) as UserReminder;

describe("upcomingTimes", () => {
  it("rings a one-off once, and never once done or past", () => {
    expect(upcomingTimes(reminder({}), at("2026-09-25T10:00:00"))).toEqual([
      at("2026-09-25T15:00:00"),
    ]);
    expect(
      upcomingTimes(reminder({ done_at: "2026-09-25T11:00:00" }), at("2026-09-25T10:00:00")),
    ).toEqual([]);
    expect(upcomingTimes(reminder({}), at("2026-09-25T16:00:00"))).toEqual([]);
  });

  it("rolls a daily reminder forward past now", () => {
    const times = upcomingTimes(reminder({ repeat: "daily" }), at("2026-09-27T16:00:00"), 2);
    expect(times).toEqual([at("2026-09-28T15:00:00"), at("2026-09-29T15:00:00")]);
  });

  it("skips Friday and Saturday for weekdays", () => {
    // 25 Sep 2026 is a Friday.
    const times = upcomingTimes(reminder({ repeat: "weekdays" }), at("2026-09-24T16:00:00"), 2);
    expect(times).toEqual([at("2026-09-27T15:00:00"), at("2026-09-28T15:00:00")]);
  });

  it("treats done on a repeat as done for that time only", () => {
    const times = upcomingTimes(
      reminder({ repeat: "daily", done_at: "2026-09-25T15:05:00" }),
      at("2026-09-25T09:00:00"),
      1,
    );
    expect(times).toEqual([at("2026-09-26T15:00:00")]);
  });
});

describe("reminderNotifications", () => {
  it("schedules each ring in the window with a stable id", () => {
    const list = reminderNotifications(
      [reminder({ repeat: "daily" })],
      at("2026-09-25T10:00:00").getTime(),
      2,
    );
    expect(list.map((n) => new Date(n.at).toISOString())).toEqual([
      at("2026-09-25T15:00:00").toISOString(),
      at("2026-09-26T15:00:00").toISOString(),
    ]);
    expect(list[0]!.id).toBe(`reminder-r1-${at("2026-09-25T15:00:00").getTime()}`);
  });
});
