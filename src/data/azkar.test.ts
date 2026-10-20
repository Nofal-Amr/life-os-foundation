import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const lang = vi.hoisted(() => ({ value: "en" as "en" | "ar" }));
vi.mock("@/lib/i18n", () => ({ getLang: () => lang.value, t: (text: string) => text }));

import { AZKAR, sourceLabel } from "./azkar";

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
