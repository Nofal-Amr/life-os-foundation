// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { MoreOptions } from "./MoreOptions";

afterEach(cleanup);

function renderFold(props: Partial<Parameters<typeof MoreOptions>[0]> = {}) {
  return render(
    <form>
      <label htmlFor="title">Title</label>
      <input id="title" />
      <MoreOptions {...props}>
        <label htmlFor="priority">Priority</label>
        <input id="priority" />
      </MoreOptions>
    </form>,
  );
}

describe("MoreOptions", () => {
  it("starts folded: the extra fields are hidden, the main ones are not", () => {
    renderFold();
    expect(screen.getByLabelText("Title")).toBeVisible();
    expect(screen.getByLabelText("Priority")).not.toBeVisible();
    expect(screen.getByRole("button", { name: "More options" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("opens and closes on tap", async () => {
    renderFold();
    const toggle = screen.getByRole("button", { name: "More options" });
    await userEvent.click(toggle);
    expect(screen.getByLabelText("Priority")).toBeVisible();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(toggle);
    expect(screen.getByLabelText("Priority")).not.toBeVisible();
  });

  it("says how many folded fields are filled, while folded", async () => {
    renderFold({ setCount: 3 });
    expect(screen.getByText("3 set")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /More options/ }));
    expect(screen.queryByText("3 set")).toBeNull();
  });

  it("shows no count when nothing is filled", () => {
    renderFold({ setCount: 0 });
    expect(screen.queryByText(/set$/)).toBeNull();
  });

  it("can start open, e.g. when editing something that uses the extras", () => {
    renderFold({ defaultOpen: true });
    expect(screen.getByLabelText("Priority")).toBeVisible();
  });

  it("does not submit the form", async () => {
    let submitted = false;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted = true;
        }}
      >
        <MoreOptions>
          <span>x</span>
        </MoreOptions>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "More options" }));
    expect(submitted).toBe(false);
  });
});
