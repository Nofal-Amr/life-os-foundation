import { describe, expect, it } from "vitest";

import { missingColumnOf, withoutColumn } from "./offline";

describe("missingColumnOf", () => {
  it("reads the column out of PostgREST's message", () => {
    expect(
      missingColumnOf("Could not find the 'updated_at' column of 'resource_readings' in the schema cache"),
    ).toBe("updated_at");
    expect(missingColumnOf("some other error")).toBeNull();
    expect(missingColumnOf(undefined)).toBeNull();
  });
});

describe("withoutColumn", () => {
  it("drops the column from one row", () => {
    expect(withoutColumn(JSON.stringify({ reading: 5, updated_at: "x" }), "updated_at")).toBe(
      JSON.stringify({ reading: 5 }),
    );
  });

  it("drops it from every row of a list", () => {
    const body = JSON.stringify([{ a: 1, bad: 2 }, { a: 2, bad: 3 }]);
    expect(withoutColumn(body, "bad")).toBe(JSON.stringify([{ a: 1 }, { a: 2 }]));
  });

  it("is null when the column is not there or the body is not JSON", () => {
    expect(withoutColumn(JSON.stringify({ a: 1 }), "bad")).toBeNull();
    expect(withoutColumn("not json", "bad")).toBeNull();
  });
});
