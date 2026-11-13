// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { layoutMap, type Person, type PersonLink } from "@/data/relationships";

import { RelationshipMap } from "./RelationshipMap";

const person = (id: string, name: string, extra: Partial<Person> = {}): Person => ({
  id,
  is_me: false,
  name,
  relation: "relative",
  circle: "relatives",
  birthday_month: null,
  birthday_day: null,
  birth_year: null,
  phone: null,
  notes: null,
  goal: null,
  checkin_every_days: null,
  checkin_since: null,
  ...extra,
});

const people = [
  person("me", "Me", { is_me: true, relation: "me", circle: "me" }),
  person("father", "Baba", { relation: "father", circle: "closest" }),
  person("mother", "Mama", { relation: "mother", circle: "closest" }),
  person("samir", "Uncle Samir", { relation: "uncle_aunt" }),
  person("hassan", "Uncle Hassan", { relation: "uncle_aunt" }),
];
const links: PersonLink[] = [
  { id: "1", from_person: "father", to_person: "me", kind: "parent" },
  { id: "2", from_person: "mother", to_person: "me", kind: "parent" },
  { id: "3", from_person: "samir", to_person: "father", kind: "sibling" },
  { id: "4", from_person: "hassan", to_person: "mother", kind: "sibling" },
];

function Harness() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <RelationshipMap
      layout={layoutMap(people, links)}
      links={links}
      selectedId={selected}
      onSelect={setSelected}
    />
  );
}

afterEach(cleanup);

describe("RelationshipMap", () => {
  it("draws everyone, and selecting Father lights his side without hiding anyone", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const node = (name: RegExp) => screen.getByRole("button", { name });
    expect(screen.getAllByRole("button", { name: /,/ })).toHaveLength(5);
    expect(node(/^Baba/)).not.toHaveAttribute("data-lit");

    await user.click(node(/^Baba/));
    expect(node(/^Baba/)).toHaveAttribute("aria-pressed", "true");
    expect(node(/^Uncle Samir/)).toHaveAttribute("data-lit", "true");
    expect(node(/^Me/)).toHaveAttribute("data-lit", "true");
    expect(node(/^Mama/)).toHaveAttribute("data-lit", "false");
    expect(node(/^Uncle Hassan/)).toHaveAttribute("data-lit", "false");
    // Dimmed, still there.
    expect(node(/^Uncle Hassan/)).toHaveAttribute("opacity", "0.22");

    await user.keyboard("{Escape}");
    expect(node(/^Mama/)).not.toHaveAttribute("data-lit");
  });

  it("can be selected from the keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("button", { name: /^Mama/ }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /^Uncle Hassan/ })).toHaveAttribute(
      "data-lit",
      "true",
    );
  });
});
