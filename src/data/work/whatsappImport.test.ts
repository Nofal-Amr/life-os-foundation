import { describe, expect, it } from "vitest";

import {
  classify,
  dayEntries,
  guessDateOrder,
  matchMember,
  parseChat,
  punches,
  reasonFor,
  timeInText,
} from "./whatsappImport";

const ANDROID = `16/11/2026, 07:58 - Messages and calls are end-to-end encrypted.
16/11/2026, 08:03 - Ahmed Ali: in
16/11/2026, 08:10 - Sara: Good morning, checked in
16/11/2026, 09:00 - Ahmed Ali: in traffic? no, I was here already
second line of the same message
16/11/2026, 16:31 - Ahmed Ali: out
16/11/2026, 17:40 - Sara: out 5:30
16/11/2026, 17:45 - Sara: <Media omitted>`;

describe("parseChat", () => {
  it("reads Android exports and skips system lines and continuations", () => {
    const messages = parseChat(ANDROID);
    expect(messages.map((item) => [item.sender, item.day, item.time])).toEqual([
      ["Ahmed Ali", "2026-11-16", "08:03"],
      ["Sara", "2026-11-16", "08:10"],
      ["Ahmed Ali", "2026-11-16", "09:00"],
      ["Ahmed Ali", "2026-11-16", "16:31"],
      ["Sara", "2026-11-16", "17:40"],
      ["Sara", "2026-11-16", "17:45"],
    ]);
  });

  it("reads iPhone exports with seconds and am/pm", () => {
    const messages = parseChat(
      "\u200e[11/16/26, 8:03:12\u202fAM] Ahmed: in\n[11/16/26, 4:30:00 PM] Ahmed: out",
      "mdy",
    );
    expect(messages.map((item) => [item.day, item.time, item.text])).toEqual([
      ["2026-11-16", "08:03", "in"],
      ["2026-11-16", "16:30", "out"],
    ]);
  });

  it("reads Arabic exports with Arabic digits and ص/م", () => {
    const text =
      "١٦\u200f/١١\u200f/٢٠٢٦، ٨:٠٣ ص - أحمد: حضور\n١٦\u200f/١١\u200f/٢٠٢٦، ٤:٣٠ م - أحمد: انصراف";
    expect(parseChat(text).map((item) => [item.sender, item.day, item.time, item.text])).toEqual([
      ["أحمد", "2026-11-16", "08:03", "حضور"],
      ["أحمد", "2026-11-16", "16:30", "انصراف"],
    ]);
  });

  it("drops dates that don't exist", () => {
    expect(parseChat("31/02/2026, 08:00 - A: in", "dmy")).toEqual([]);
  });
});

describe("guessDateOrder", () => {
  it("uses any date that only fits one way, else day first", () => {
    expect(guessDateOrder("16/11/2026, 08:00 - A: in")).toBe("dmy");
    expect(guessDateOrder("11/16/2026, 08:00 - A: in")).toBe("mdy");
    expect(guessDateOrder("05/11/2026, 08:00 - A: in")).toBe("dmy");
  });
});

describe("classify", () => {
  it("knows English and Arabic clock-ins and clock-outs", () => {
    expect(classify("in")).toBe("in");
    expect(classify("IN 8:05")).toBe("in");
    expect(classify("Checked in ✅")).toBe("in");
    expect(classify("حضور")).toBe("in");
    expect(classify("وصلت الحمد لله")).toBe("in");
    expect(classify("out")).toBe("out");
    expect(classify("Clocking out")).toBe("out");
    expect(classify("انصراف")).toBe("out");
    expect(classify("مشيت")).toBe("out");
  });

  it("ignores sentences and messages that read as both", () => {
    expect(classify("in traffic, will be late")).toBeNull();
    expect(classify("going out for lunch")).toBeNull();
    expect(classify("checked in and checked out")).toBeNull();
    expect(classify("<Media omitted>")).toBeNull();
  });
});

describe("timeInText", () => {
  it("uses a time written in the message, nearest to when it was posted", () => {
    expect(timeInText("out 5:30", "17:40")).toBe("17:30");
    expect(timeInText("in 8:05", "09:15")).toBe("08:05");
    expect(timeInText("out 5:30 pm", "09:00")).toBe("17:30");
    expect(timeInText("حضور ٨:١٥ ص", "10:00")).toBe("08:15");
    expect(timeInText("out", "17:40")).toBeNull();
  });
});

describe("dayEntries", () => {
  it("keeps the first clock-in and the last clock-out per person and day", () => {
    const rows = dayEntries(punches(parseChat(ANDROID)));
    expect(
      rows.map((row) => [row.sender, row.day, row.in?.at ?? null, row.out?.at ?? null]),
    ).toEqual([
      ["Ahmed Ali", "2026-11-16", "08:03", "16:31"],
      ["Sara", "2026-11-16", "08:10", "17:30"],
    ]);
  });

  it("puts an early-morning clock-out on the open shift of the day before", () => {
    const text =
      "16/11/2026, 20:00 - Omar: in\n17/11/2026, 04:10 - Omar: out\n17/11/2026, 20:05 - Omar: in";
    const rows = dayEntries(punches(parseChat(text)));
    expect(rows.map((row) => [row.day, row.in?.at ?? null, row.out?.at ?? null])).toEqual([
      ["2026-11-16", "20:00", "04:10"],
      ["2026-11-17", "20:05", null],
    ]);
    expect(rows[0]!.out!.day).toBe("2026-11-17");
  });
});

describe("matchMember", () => {
  const members = [
    { display_name: "Ahmed Ali" },
    { display_name: "Sara Hassan" },
    { display_name: "Sara Adel" },
  ];
  it("matches exact names and unique first names only", () => {
    expect(matchMember("ahmed ali", members)?.display_name).toBe("Ahmed Ali");
    expect(matchMember("Ahmed", members)?.display_name).toBe("Ahmed Ali");
    expect(matchMember("Sara", members)).toBeNull();
    expect(matchMember("+20 100 000 0000", members)).toBeNull();
  });
});

describe("reasonFor", () => {
  it("names the source and stays within the limit", () => {
    const [punch] = punches(parseChat("16/11/2026, 08:03 - A: in"));
    expect(reasonFor(punch!)).toBe("WhatsApp 2026-11-16 08:03: in");
    const long = punches(parseChat(`16/11/2026, 08:03 - A: checked in ${"x".repeat(400)}`));
    expect(reasonFor(long[0]!).length).toBe(300);
  });
});
