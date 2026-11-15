// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/demo", () => ({ isDemo: () => true }));
vi.mock("@/data/spirit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/data/spirit")>()),
  sunnahLogsQuery: () => ({ queryKey: ["test-sunnah"], queryFn: () => [] }),
}));

import { PrayerDayList } from "./PrayerLog";

afterEach(cleanup);

const at = (hours: number, minutes = 0) => new Date(2026, 10, 15, hours, minutes);

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PrayerDayList
        date="2026-11-15"
        logs={[]}
        times={{
          fajr: at(4, 50),
          dhuhr: at(11, 40),
          asr: at(14, 38),
          maghrib: at(16, 59),
          isha: at(18, 19),
        }}
        next="dhuhr"
        formatTime={(date) => `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`}
        sunrise={at(6, 20)}
        duhaFrom={at(6, 35)}
        onAlarm={() => {}}
      />
    </QueryClientProvider>,
  );
}

describe("PrayerDayList", () => {
  it("shows the whole day as one list with sunrise as a divider row", () => {
    renderList();
    const list = screen.getByRole("list", { name: "Prayers" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.dataset["row"])).toEqual([
      "sunnah_fajr",
      "fajr",
      "sunrise",
      "duha",
      "dhuhr",
      "asr",
      "maghrib",
      "isha",
      "witr",
    ]);
    expect(within(rows[2]!).queryByRole("button", { name: /Log/ })).toBeNull();
  });

  it("puts the wake-up alarm inside each of the five rows, not in a tile beside it", () => {
    renderList();
    for (const name of ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha", "Sunrise"]) {
      const alarm = screen.getByRole("button", { name: `Wake-up alarm before ${name}` });
      const row = alarm.closest("li")!;
      expect(row).toHaveTextContent(name);
      expect(row.querySelector(".stat-card")).toBeNull();
    }
    // The sunnah prayers have no alarm, but keep the slot so the rows line up.
    const witr = screen.getByRole("button", { name: /^Witr:/ }).closest("li")!;
    expect(within(witr).queryByRole("button", { name: /Wake-up alarm/ })).toBeNull();
    expect(witr.lastElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps every row compact with a 44px status control", () => {
    renderList();
    for (const button of screen.getAllByRole("button", { name: /: Log$/ })) {
      expect(button).toHaveClass("h-11");
      expect(button.closest("li")).toHaveClass("min-h-14");
    }
    expect(screen.getByRole("button", { name: "Duha: Log" }).closest("li")).toHaveTextContent(
      "15 min after sunrise, until Dhuhr",
    );
  });
});
