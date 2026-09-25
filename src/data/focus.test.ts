import { describe, expect, it } from "vitest";

import { focusGroup, relativeDay } from "./focus";

const today = "2026-09-25";

describe("relativeDay", () => {
  it("says it in words", () => {
    expect(relativeDay("2026-09-25", today)).toBe("Today");
    expect(relativeDay("2026-09-26", today)).toBe("Tomorrow");
    expect(relativeDay("2026-09-28", today)).toBe("In 3 days");
    expect(relativeDay("2026-09-24", today)).toBe("Yesterday");
    expect(relativeDay("2026-09-21", today)).toBe("4 days ago");
    expect(relativeDay("2026-10-20", today)).toBe("20 Oct");
  });
});

describe("focusGroup", () => {
  it("sorts due dates into earlier, today and soon", () => {
    expect(focusGroup("2026-09-20", today)).toBe("earlier");
    expect(focusGroup(today, today)).toBe("today");
    expect(focusGroup("2026-09-28", today)).toBe("soon");
    expect(focusGroup("2026-09-29", today)).toBeNull();
    expect(focusGroup(null, today)).toBeNull();
  });
});
