import { describe, expect, it } from "vitest";
import type { ConnectStatus } from "@/lib/native";
import { peerName, peerState } from "./connectPeer";

const base: ConnectStatus = {
  role: "main",
  connected: true,
  phone: true,
  callLog: true,
  answer: true,
  contacts: true,
  notifications: true,
  battery: true,
  sms: true,
  fullScreen: true,
};

describe("peerState", () => {
  it("says nothing without Life Connect", () => {
    expect(peerState(null)).toBe("unknown");
    expect(peerState({ ...base, role: "off" })).toBe("unknown");
  });
  it("can't know while this phone is off the relay", () => {
    expect(peerState({ ...base, connected: false, peerLink: { seen: true, online: true } })).toBe(
      "connecting",
    );
  });
  it("reports the relay's list once the other phone has shown up", () => {
    expect(peerState({ ...base, peerLink: { seen: true, online: true } })).toBe("online");
    expect(peerState({ ...base, peerLink: { seen: true, online: false, since: 1 } })).toBe(
      "offline",
    );
  });
  it("never claims offline for a phone it has never seen", () => {
    expect(peerState({ ...base, peerLink: { seen: false, online: false } })).toBe("unknown");
    expect(peerState(base)).toBe("unknown");
  });
});

describe("peerName", () => {
  it("names the other phone", () => {
    expect(peerName({ ...base, peer: "POCO" })).toBe("POCO");
    expect(peerName(base)).toBe("SIM phone");
    expect(peerName({ ...base, role: "sim" })).toBe("Main phone");
  });
});
