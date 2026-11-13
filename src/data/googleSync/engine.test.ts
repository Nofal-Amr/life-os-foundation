import { beforeEach, describe, expect, it } from "vitest";

import { syncCalendar, type SyncCalendarInput } from "./engine";
import { Clock, FakeGoogle, MemoryStore } from "./fakes";

const START = Date.parse("2026-11-13T08:00:00.000Z");

let clock: Clock;
let google: FakeGoogle;
let store: MemoryStore;
let token: string | null;

async function sync(over: Partial<SyncCalendarInput> = {}) {
  const r = await syncCalendar({
    calendarId: "primary",
    canWrite: true,
    pushNew: true,
    syncToken: token,
    timeZone: "Africa/Cairo",
    now: new Date(clock.ms),
    google,
    store,
    ...over,
  });
  token = r.syncToken;
  clock.tick();
  return r;
}

const titles = () => [...store.events.values()].map((e) => e.title).sort();

beforeEach(() => {
  clock = new Clock(START);
  google = new FakeGoogle(clock);
  store = new MemoryStore(clock);
  token = null;
});

describe("pull", () => {
  it("imports every page of a first full pull and keeps the sync token", async () => {
    for (const n of [1, 2, 3]) {
      google.put({
        id: `a${n}`,
        summary: `Meeting ${n}`,
        start: { dateTime: "2026-11-14T09:00:00Z" },
        end: { dateTime: "2026-11-14T10:00:00Z" },
      });
    }
    const r = await sync();
    expect(r.imported).toBe(3);
    expect(titles()).toEqual(["Meeting 1", "Meeting 2", "Meeting 3"]);
    expect(token).toMatch(/^t/);
    expect(google.calls.filter((c) => c === "list:full")).toHaveLength(2); // two pages
  });

  it("uses the sync token next time and applies only what changed", async () => {
    google.put({ id: "a", summary: "Dentist", start: { dateTime: "2026-11-15T09:00:00Z" } });
    await sync();
    google.put({ id: "a", summary: "Dentist (moved)", start: { dateTime: "2026-11-16T09:00:00Z" } });
    const r = await sync();
    expect(google.calls.at(-1)).toBe("list:incremental");
    expect(r.updatedHere).toBe(1);
    expect(titles()).toEqual(["Dentist (moved)"]);
  });

  it("starts a full pull again when Google says the token expired (410)", async () => {
    google.put({ id: "a", summary: "Gym", start: { dateTime: "2026-11-15T17:00:00Z" } });
    await sync();
    google.expireTokens = true;
    const r = await sync();
    google.expireTokens = false;
    expect(google.calls.slice(-2)).toEqual(["list:incremental", "list:full"]);
    expect(r.syncToken).toBeTruthy();
    expect(titles()).toEqual(["Gym"]); // not imported twice
  });

  it("deletes the Life OS copy when an event is cancelled in Google", async () => {
    google.put({ id: "a", summary: "Call", start: { dateTime: "2026-11-15T12:00:00Z" } });
    await sync();
    google.cancel("a");
    const r = await sync();
    expect(r.removedHere).toBe(1);
    expect(store.events.size).toBe(0);
    expect(store.links.size).toBe(0);
  });

  it("maps all-day events to local midnight through 23:59 of the last day", async () => {
    google.put({ id: "a", summary: "Trip", start: { date: "2026-11-20" }, end: { date: "2026-11-22" } });
    await sync();
    const e = [...store.events.values()][0]!;
    // Cairo is UTC+2 in November.
    expect(e.start_at).toBe("2026-11-19T22:00:00.000Z");
    expect(e.end_at).toBe("2026-11-21T21:59:00.000Z");
    expect([...store.links.values()][0]!.all_day).toBe(true);
  });
});

describe("push", () => {
  it("sends new Life OS events to the chosen calendar, once", async () => {
    store.add({ title: "Write report", description: null, start_at: "2026-11-14T10:00:00.000Z", end_at: null });
    const r = await sync();
    expect(r.sentToGoogle).toBe(1);
    const g = [...google.events.values()][0]!;
    expect(g.summary).toBe("Write report");
    expect(g.end?.dateTime).toBe("2026-11-14T11:00:00.000Z"); // no end → one hour
    await sync();
    expect(google.calls.filter((c) => c === "insert")).toHaveLength(1);
    expect(store.events.size).toBe(1); // its echo isn't imported back
  });

  it("does not send new events to a calendar that isn't the one chosen for them", async () => {
    store.add({ title: "Private", description: null, start_at: "2026-11-14T10:00:00.000Z", end_at: null });
    await sync({ pushNew: false });
    expect(google.events.size).toBe(0);
  });

  it("leaves events from long ago alone", async () => {
    store.add({ title: "Old", description: null, start_at: "2026-01-01T10:00:00.000Z", end_at: null });
    await sync();
    expect(google.events.size).toBe(0);
  });

  it("sends Life OS edits and deletions to Google", async () => {
    google.put({ id: "a", summary: "Lunch", start: { dateTime: "2026-11-15T12:00:00Z" }, end: { dateTime: "2026-11-15T13:00:00Z" } });
    await sync();
    const id = [...store.events.keys()][0]!;
    store.edit(id, { title: "Lunch with Sara" });
    expect((await sync()).sentToGoogle).toBe(1);
    expect(google.events.get("a")!.summary).toBe("Lunch with Sara");
    store.remove(id);
    expect((await sync()).removedFromGoogle).toBe(1);
    expect(google.events.get("a")!.status).toBe("cancelled");
    expect(store.links.size).toBe(0);
  });

  it("keeps all-day events all-day when edited in Life OS", async () => {
    google.put({ id: "a", summary: "Holiday", start: { date: "2026-11-20" }, end: { date: "2026-11-21" } });
    await sync();
    store.edit([...store.events.keys()][0]!, { title: "Holiday!" });
    await sync();
    expect(google.events.get("a")!.start).toEqual({ date: "2026-11-20" });
    expect(google.events.get("a")!.end).toEqual({ date: "2026-11-21" });
  });

  it("never writes to a read-only calendar, and Google's copy comes back", async () => {
    google.put({ id: "a", summary: "Public holiday", start: { date: "2026-11-20" } });
    await sync({ canWrite: false, pushNew: false });
    const id = [...store.events.keys()][0]!;
    store.remove(id);
    google.put({ id: "a", summary: "Public holiday (observed)", start: { date: "2026-11-20" } });
    await sync({ canWrite: false, pushNew: false });
    expect(google.calls).not.toContain("delete");
    expect(titles()).toEqual(["Public holiday (observed)"]);
  });
});

describe("conflicts: the most recent edit wins", () => {
  async function linked() {
    google.put({ id: "a", summary: "Original", start: { dateTime: "2026-11-15T12:00:00Z" } });
    await sync();
    return [...store.events.keys()][0]!;
  }

  it("Google wins when it was edited last", async () => {
    const id = await linked();
    store.edit(id, { title: "Edited here" });
    google.put({ id: "a", summary: "Edited in Google", start: { dateTime: "2026-11-15T12:00:00Z" } });
    await sync();
    expect(titles()).toEqual(["Edited in Google"]);
    expect(google.events.get("a")!.summary).toBe("Edited in Google");
  });

  it("Life OS wins when it was edited last", async () => {
    const id = await linked();
    google.put({ id: "a", summary: "Edited in Google", start: { dateTime: "2026-11-15T12:00:00Z" } });
    store.edit(id, { title: "Edited here" });
    await sync();
    expect(titles()).toEqual(["Edited here"]);
    expect(google.events.get("a")!.summary).toBe("Edited here");
  });

  it("re-checks when Google changes it between the pull and the push (412)", async () => {
    const id = await linked();
    store.edit(id, { title: "Edited here" });
    // Simulate a Google edit that the pull didn't see: bump the etag silently.
    const g = google.events.get("a")!;
    google.events.set("a", { ...g, etag: '"sneaky"', summary: "Older Google edit", updated: "2026-11-13T07:00:00.000Z" });
    await sync();
    expect(google.events.get("a")!.summary).toBe("Edited here");
  });
});
