import { afterEach, describe, expect, it } from "vitest";

import { setLang, t, tChildren } from "./i18n";

afterEach(() => setLang("en"));

describe("i18n", () => {
  it("leaves English as it is", () => {
    expect(t("Save")).toBe("Save");
  });

  it("translates known phrases in Arabic, keeping endings, and leaves the rest", () => {
    setLang("ar");
    expect(t("Save")).toBe("حفظ");
    expect(t("Delete this task?")).toBe("حذف هذه المهمة؟");
    expect(t("Save.")).toBe("حفظ.");
    expect(t("Something not in the dictionary")).toBe("Something not in the dictionary");
    expect(tChildren(["Save", 3])).toEqual(["حفظ", 3]);
  });
});
