// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ListRow, RowCheck, RowList } from "./ListRow";

beforeAll(() => {
  // Radix menus measure and observe; jsdom has neither.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});

afterEach(cleanup);

function renderRow(props: Partial<Parameters<typeof ListRow>[0]> = {}) {
  return render(
    <RowList>
      <ListRow title="Buy printer ink" {...props} />
    </RowList>,
  );
}

describe("ListRow", () => {
  it("opens when the row is tapped", async () => {
    const onOpen = vi.fn();
    renderRow({ onOpen, openLabel: "Edit Buy printer ink" });
    await userEvent.click(screen.getByRole("button", { name: "Edit Buy printer ink" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("is not a button when there is nothing to open", () => {
    renderRow();
    expect(screen.getByText("Buy printer ink")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("never shows Delete on the row itself, only in …", async () => {
    const onDelete = vi.fn();
    renderRow({
      onOpen: () => {},
      actions: [
        { label: "Duplicate", onSelect: () => {} },
        { label: "Delete", onSelect: onDelete, destructive: true },
      ],
    });
    expect(screen.queryByText("Delete")).toBeNull();
    expect(screen.queryByText("Duplicate")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "More for Buy printer ink" }));
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    // Delete-style actions come last.
    expect(items.map((item) => item.textContent)).toEqual(["Duplicate", "Delete"]);
    expect(within(menu).getByRole("separator")).toBeInTheDocument();

    await userEvent.click(within(menu).getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("choosing from … does not also open the row", async () => {
    const onOpen = vi.fn();
    const onSelect = vi.fn();
    renderRow({ onOpen, actions: [{ label: "Archive", onSelect }] });
    await userEvent.click(screen.getByRole("button", { name: "More for Buy printer ink" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Archive" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("has no … when there are no other actions", () => {
    renderRow({ onOpen: () => {} });
    expect(screen.queryByRole("button", { name: /More for/ })).toBeNull();
  });

  it("names … after the row when the title is not plain text", () => {
    renderRow({
      title: <span>Rent</span>,
      openLabel: "Edit Rent",
      onOpen: () => {},
      actions: [{ label: "Skip", onSelect: () => {} }],
    });
    expect(screen.getByRole("button", { name: "More for Edit Rent" })).toBeInTheDocument();
  });

  it("the primary action works without opening the row", async () => {
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    renderRow({
      onOpen,
      leading: <RowCheck done={false} onToggle={onToggle} label="Complete Buy printer ink" />,
    });
    await userEvent.click(screen.getByRole("button", { name: "Complete Buy printer ink" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("shows meta, trailing figure and extras", () => {
    renderRow({
      meta: <span>Due Thu · Work</span>,
      trailing: <span>EGP 120</span>,
      children: <button type="button">Help me start</button>,
    });
    expect(screen.getByText("Due Thu · Work")).toBeInTheDocument();
    expect(screen.getByText("EGP 120")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Help me start" })).toBeInTheDocument();
  });

  it("is a list item, so screen readers count the rows", () => {
    renderRow();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("keeps every control at least 44 px", () => {
    renderRow({
      onOpen: () => {},
      leading: <RowCheck done={false} onToggle={() => {}} label="Complete" />,
      actions: [{ label: "Delete", onSelect: () => {}, destructive: true }],
    });
    expect(screen.getByRole("button", { name: "Complete" })).toHaveClass("size-11");
    expect(screen.getByRole("button", { name: /More for/ })).toHaveClass("size-11");
  });
});

describe("RowCheck", () => {
  it("says whether it is done", () => {
    const { rerender } = render(<RowCheck done={false} onToggle={() => {}} label="Log today" />);
    expect(screen.getByRole("button", { name: "Log today" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    rerender(<RowCheck done onToggle={() => {}} label="Undo today" />);
    expect(screen.getByRole("button", { name: "Undo today" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does nothing while disabled", async () => {
    const onToggle = vi.fn();
    render(<RowCheck done={false} disabled onToggle={onToggle} label="Complete" />);
    await userEvent.click(screen.getByRole("button", { name: "Complete" }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
