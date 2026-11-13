import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const lang = vi.hoisted(() => ({ value: "en" as "en" | "ar" }));
vi.mock("@/lib/i18n", () => ({ getLang: () => lang.value, t: (text: string) => text }));

import { AZKAR, afterPrayerAzkar, azkarMoment, sourceLabel } from "./azkar";

describe("Ayat al-Kursi", () => {
  const kursi = AZKAR.find((zikr) => zikr.id === "kursi")!;

  it("says where it's from", () => {
    expect(kursi.source).toBe("Al-Baqarah 2:255");
  });

  it("carries tashkeel", () => {
    expect(kursi.text).toMatch(/[ً-ْ]/);
    // The same words as the plain text, once the marks are taken off.
    const plain = kursi
      .text!.replace(/[ً-ْۖ-ۜ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    expect(plain).toBe(
      "الله لا إله إلا هو الحي القيوم لا تأخذه سنة ولا نوم له ما في السماوات وما في الأرض من ذا الذي يشفع عنده إلا بإذنه يعلم ما بين أيديهم وما خلفهم ولا يحيطون بشيء من علمه إلا بما شاء وسع كرسيه السماوات والأرض ولا يئوده حفظهما وهو العلي العظيم",
    );
  });
});

describe("sourceLabel", () => {
  afterEach(() => {
    lang.value = "en";
  });

  it("keeps the English form", () => {
    expect(sourceLabel("Al-Baqarah 2:255")).toBe("Al-Baqarah 2:255");
  });

  it("gives the surah's Arabic name and Arabic digits", () => {
    lang.value = "ar";
    expect(sourceLabel("Al-Baqarah 2:255")).toBe("البقرة: ٢٥٥");
    expect(sourceLabel("Al-Ikhlas 112:1–4")).toBe("الإخلاص: ١–٤");
  });
});

describe("after-prayer azkar", () => {
  const ids = (prayer: Parameters<typeof afterPrayerAzkar>[0]) =>
    afterPrayerAzkar(prayer).map(({ zikr }) => zikr.id);

  it("has the 33 + 33 + 33 tasbih and the tahlil that completes 100", () => {
    const counts = Object.fromEntries(
      afterPrayerAzkar("dhuhr").map(({ zikr, count }) => [zikr.id, count]),
    );
    expect(counts["ap-subhan"]).toBe(33);
    expect(counts["ap-hamd"]).toBe(33);
    expect(counts["ap-takbir"]).toBe(33);
    expect(counts["ap-tamam"]).toBe(1);
  });

  it("adds the Fajr and Maghrib extras only after those two", () => {
    expect(ids("fajr")).toContain("ap-yuhyi");
    expect(ids("maghrib")).toContain("ap-yuhyi");
    expect(ids("asr")).not.toContain("ap-yuhyi");
    expect(ids("fajr")).toContain("ap-ilman");
    expect(ids("maghrib")).not.toContain("ap-ilman");
  });

  it("says the three Quls three times after Fajr and Maghrib, once otherwise", () => {
    const count = (prayer: Parameters<typeof afterPrayerAzkar>[0]) =>
      afterPrayerAzkar(prayer).find(({ zikr }) => zikr.id === "ap-ikhlas")!.count;
    expect(count("fajr")).toBe(3);
    expect(count("maghrib")).toBe(3);
    expect(count("isha")).toBe(1);
  });

  it("has unique ids", () => {
    const all = ids("fajr");
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("azkarMoment", () => {
  const at = (hhmm: string) => new Date(`2026-11-13T${hhmm}:00`);
  const times = {
    fajr: at("04:50"),
    dhuhr: at("11:40"),
    asr: at("14:40"),
    maghrib: at("17:00"),
    isha: at("18:20"),
  };

  it("offers the after-prayer azkar in the half hour after a prayer", () => {
    expect(azkarMoment(at("14:50"), times)).toEqual({ set: "after_prayer", prayer: "asr" });
    expect(azkarMoment(at("05:10"), times)).toEqual({ set: "after_prayer", prayer: "fajr" });
  });

  it("offers morning or evening azkar otherwise", () => {
    expect(azkarMoment(at("07:00"), times)).toEqual({ set: "morning", prayer: "fajr" });
    expect(azkarMoment(at("15:30"), times)).toEqual({ set: "evening", prayer: "asr" });
  });

  it("knows the last prayer even before Fajr (yesterday's Isha)", () => {
    expect(azkarMoment(at("03:00"), times).prayer).toBe("isha");
  });

  it("works without times", () => {
    expect(azkarMoment(at("08:00"), null)).toEqual({ set: "morning", prayer: null });
  });
});
