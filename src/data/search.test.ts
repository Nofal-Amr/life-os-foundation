import { describe, expect, it } from "vitest";

import { normalize, searchItems, type SearchItem } from "./search";

const items: SearchItem[] = [
  { kind: "task", id: "1", title: "Pay the electricity bill" },
  { kind: "task", id: "2", title: "Electricity meter reading" },
  { kind: "note", id: "3", title: "Ideas", body: "ask about electricity tariff" },
  { kind: "note", id: "4", title: "أحمد birthday" },
  { kind: "food", id: "5", title: "Café latte" },
];

describe("normalize", () => {
  it("ignores case, accents and Arabic letter variants", () => {
    expect(normalize("Café  LATTE")).toBe("cafe latte");
    expect(normalize("أحمد")).toBe(normalize("احمد"));
    expect(normalize("مدرسة")).toBe("مدرسه");
  });
});

describe("searchItems", () => {
  it("ranks titles that start with the query first, body matches last", () => {
    expect(searchItems(items, "electricity").map((r) => r.id)).toEqual(["2", "1", "3"]);
  });

  it("finds Arabic names written either way", () => {
    expect(searchItems(items, "احمد").map((r) => r.id)).toEqual(["4"]);
  });

  it("finds accented words typed without accents", () => {
    expect(searchItems(items, "cafe").map((r) => r.id)).toEqual(["5"]);
  });

  it("needs at least two characters and caps each kind", () => {
    expect(searchItems(items, "e")).toEqual([]);
    expect(searchItems(items, "electricity", 1).map((r) => r.id)).toEqual(["2", "3"]);
  });
});
