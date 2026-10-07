import { afterEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession } } }));

import { supabase } from "@/integrations/supabase/client";

import { installOfflineSession } from "./session";

const stored = { access_token: "old", expires_at: 1, user: { id: "u1" } };
const entries: Record<string, string> = { "sb-abc-auth-token": JSON.stringify(stored) };
vi.stubGlobal("localStorage", {
  get length() {
    return Object.keys(entries).length;
  },
  key: (i: number) => Object.keys(entries)[i] ?? null,
  getItem: (key: string) => entries[key] ?? null,
});

let offline = false;
installOfflineSession(() => offline);

afterEach(() => {
  vi.useRealTimers();
  getSession.mockReset();
  offline = false;
});

describe("installOfflineSession", () => {
  it("answers from the stored session offline, without waiting on a refresh", async () => {
    offline = true;
    getSession.mockReturnValue(new Promise(() => {}));
    const { data } = await supabase.auth.getSession();
    expect(data.session?.user.id).toBe("u1");
    expect(getSession).not.toHaveBeenCalled();
  });

  it("falls back to the stored session when the check hangs", async () => {
    vi.useFakeTimers();
    getSession.mockReturnValue(new Promise(() => {}));
    const pending = supabase.auth.getSession();
    await vi.advanceTimersByTimeAsync(4000);
    expect((await pending).data.session?.user.id).toBe("u1");
  });

  it("keeps the stored session when a refresh fails for lack of network", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: new Error("Failed to fetch") });
    const { data } = await supabase.auth.getSession();
    expect(data.session?.user.id).toBe("u1");
  });

  it("uses the live answer online", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "fresh" } } }, error: null });
    const { data } = await supabase.auth.getSession();
    expect(data.session?.user.id).toBe("fresh");
  });
});
