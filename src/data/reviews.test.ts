import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { sameDayPreviousYears } from "./reviews";

describe("sameDayPreviousYears", () => {
  it("lists the same date in earlier years", () => {
    expect(sameDayPreviousYears("2026-09-25", 3)).toEqual([
      "2025-09-25",
      "2024-09-25",
      "2023-09-25",
    ]);
  });

  it("uses 28 February when a year has no 29th", () => {
    expect(sameDayPreviousYears("2028-02-29", 4)).toEqual([
      "2027-02-28",
      "2026-02-28",
      "2025-02-28",
      "2024-02-29",
    ]);
  });
});
