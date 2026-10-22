import { describe, expect, it } from "vitest";

import { handleDemoRequest } from "./demo";

const REST = "https://x.supabase.co/rest/v1/";
const db = () => ({
  tasks: [
    { id: "1", title: "B", status: "todo", position: 2 },
    { id: "2", title: "A", status: "completed", position: 1 },
  ],
});

describe("demo mode database", () => {
  it("reads with filters and order", async () => {
    const store = db();
    const response = await handleDemoRequest(
      store,
      new Request(`${REST}tasks?select=*&order=position.asc`),
    );
    expect((await response.json()).map((row: { id: string }) => row.id)).toEqual(["2", "1"]);
    const filtered = await handleDemoRequest(
      store,
      new Request(`${REST}tasks?select=*&status=eq.todo`),
    );
    expect(await filtered.json()).toHaveLength(1);
  });

  it("answers single and maybeSingle reads", async () => {
    const store = db();
    const one = await handleDemoRequest(
      store,
      new Request(`${REST}tasks?select=*&id=eq.1`, {
        headers: { Accept: "application/vnd.pgrst.object+json" },
      }),
    );
    expect((await one.json()).title).toBe("B");
    const none = await handleDemoRequest(
      store,
      new Request(`${REST}tasks?select=*&id=eq.9`, {
        headers: { Accept: "application/vnd.pgrst.object+json" },
      }),
    );
    expect(none.status).toBe(406);
    expect((await none.json()).code).toBe("PGRST116");
  });

  it("inserts, updates and deletes, keeping the change", async () => {
    const store = db();
    const created = await handleDemoRequest(
      store,
      new Request(`${REST}tasks?select=*`, {
        method: "POST",
        body: JSON.stringify({ title: "C", status: "todo" }),
      }),
    );
    const [row] = await created.json();
    expect(row.id).toBeTruthy();
    expect(row.user_id).toBeTruthy();
    expect(store.tasks).toHaveLength(3);

    await handleDemoRequest(
      store,
      new Request(`${REST}tasks?id=eq.1`, {
        method: "PATCH",
        body: JSON.stringify({ title: "B2" }),
      }),
    );
    expect(store.tasks.find((task) => task.id === "1")?.title).toBe("B2");

    await handleDemoRequest(store, new Request(`${REST}tasks?id=eq.2`, { method: "DELETE" }));
    expect(store.tasks.map((task) => task.id)).not.toContain("2");
  });

  it("merges an upsert on its conflict columns", async () => {
    const store: Record<string, Record<string, unknown>[]> = {
      prayer_logs: [{ id: "p", prayer_date: "2026-10-22", prayer_name: "fajr", status: "late" }],
    };
    await handleDemoRequest(
      store,
      new Request(`${REST}prayer_logs?on_conflict=user_id,prayer_date,prayer_name`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ prayer_date: "2026-10-22", prayer_name: "fajr", status: "on_time" }),
      }),
    );
    expect(store["prayer_logs"]).toHaveLength(1);
    expect(store["prayer_logs"]![0]!["status"]).toBe("on_time");
  });

  it("returns an empty list for tables with no sample data", async () => {
    const response = await handleDemoRequest({}, new Request(`${REST}food_logs?select=*`));
    expect(await response.json()).toEqual([]);
  });
});
