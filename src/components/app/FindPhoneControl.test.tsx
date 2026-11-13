// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findTarget } from "@/lib/native";

import { FindPhoneControl } from "./FindPhoneControl";

const connectFind = vi.fn();
const connectFindStop = vi.fn();

beforeEach(() => {
  window.LifeOSNative = {
    canNotify: () => true,
    requestNotifications: () => {},
    scheduleReminders: () => {},
    connectFind,
    connectFindStop,
  };
});

afterEach(() => {
  cleanup();
  delete window.LifeOSNative;
  vi.clearAllMocks();
});

function result(kind: "find" | "stop", ok: boolean) {
  act(() => {
    window.dispatchEvent(new CustomEvent("life-os-connect-find", { detail: { kind, ok } }));
  });
}

describe("findTarget", () => {
  it("names the SIM phone on the main phone, and the main phone on the SIM phone", () => {
    expect(findTarget("main", "POCO")).toBe("POCO");
    expect(findTarget("main", "  ")).toBe("SIM phone");
    expect(findTarget("main")).toBe("SIM phone");
    expect(findTarget("sim", "POCO")).toBe("main phone");
  });
});

describe("FindPhoneControl", () => {
  it("asks the other phone to ring, and says when it went", async () => {
    render(<FindPhoneControl role="main" peer="POCO" connected />);
    await userEvent.click(screen.getByRole("button", { name: "Find POCO" }));
    expect(connectFind).toHaveBeenCalledWith(true, false);
    result("find", true);
    expect(screen.getByText("Sent.")).toBeInTheDocument();
  });

  it("sends ring and flash together when both are on", async () => {
    render(<FindPhoneControl role="sim" connected />);
    await userEvent.click(screen.getByRole("switch", { name: /flash/i }));
    await userEvent.click(screen.getByRole("button", { name: "Find main phone" }));
    expect(connectFind).toHaveBeenCalledWith(true, true);
  });

  it("can't send with both ring and flash off", async () => {
    render(<FindPhoneControl role="main" connected />);
    await userEvent.click(screen.getByRole("switch", { name: /ring loudly/i }));
    expect(screen.getByRole("button", { name: "Find SIM phone" })).toBeDisabled();
  });

  it("stops the find on the other phone", async () => {
    render(<FindPhoneControl role="main" connected />);
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(connectFindStop).toHaveBeenCalled();
    result("stop", true);
    expect(screen.getByText("Sent. It stops now.")).toBeInTheDocument();
  });

  it("says plainly when the relay couldn't be reached", () => {
    render(<FindPhoneControl role="main" connected />);
    result("find", false);
    expect(screen.getByText(/Couldn't reach the relay/)).toBeInTheDocument();
  });

  it("waits while not connected", () => {
    render(<FindPhoneControl role="main" connected={false} />);
    expect(screen.getByRole("button", { name: "Find SIM phone" })).toBeDisabled();
    expect(screen.getByText(/Waiting for the connection/)).toBeInTheDocument();
  });
});
