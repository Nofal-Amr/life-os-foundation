import { describe, expect, it } from "vitest";

import { buildXlsx, columnName, crc32, escapeXml, sheetNames } from "./xlsx";

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("zip parts", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("abc"))).toBe(0x352441c2);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("xlsx helpers", () => {
  it("names columns like Excel", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });

  it("keeps sheet names legal and unique", () => {
    expect(sheetNames(["Money/Spending", "Tasks", "tasks", "A".repeat(40)])).toEqual([
      "Money Spending",
      "Tasks",
      "tasks 2",
      "A".repeat(31),
    ]);
  });

  it("escapes XML and drops characters it can't hold", () => {
    expect(escapeXml('a < b & "c"\u0001')).toBe("a &lt; b &amp; &quot;c&quot;");
  });
});

describe("buildXlsx", () => {
  it("writes a zip with the workbook parts and the cell values", () => {
    const file = buildXlsx([
      {
        name: "Tasks",
        rows: [
          ["Title", "Minutes"],
          ["Call مامي", 30],
          ["Plan <trip>", null],
        ],
      },
    ]);
    // Zip signature, and the end-of-directory record at the end.
    expect([...file.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect([...file.slice(-22, -18)]).toEqual([0x50, 0x4b, 0x05, 0x06]);
    const all = text(file);
    expect(all).toContain("[Content_Types].xml");
    expect(all).toContain("xl/worksheets/sheet1.xml");
    expect(all).toContain('<sheet name="Tasks"');
    expect(all).toContain("<v>30</v>");
    expect(all).toContain("Call مامي");
    expect(all).toContain("Plan &lt;trip&gt;");
  });
});
