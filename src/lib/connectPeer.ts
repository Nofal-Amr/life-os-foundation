import { getLang, t } from "@/lib/i18n";
import type { ConnectStatus } from "@/lib/native";

/**
 * What Life Connect can honestly say about the other phone.
 * - "connecting": this phone isn't on the relay, so it can't know.
 * - "online" / "offline": the relay's own list of who's connected.
 * - "unknown": the other phone hasn't shown up yet (or runs an older app).
 */
export type PeerState = "connecting" | "online" | "offline" | "unknown";

export function peerState(status: ConnectStatus | null): PeerState {
  if (!status || status.role === "off") return "unknown";
  if (!status.connected) return "connecting";
  const link = status.peerLink;
  if (!link?.seen) return "unknown";
  return link.online ? "online" : "offline";
}

/** The other phone's name as this phone knows it. */
export function peerName(status: ConnectStatus | null): string {
  if (status?.role === "sim") return "Main phone";
  return status?.peer?.trim() || "SIM phone";
}

/** Words for the other phone's state, for the shortcut's label and the card. */
export function peerStateLabel(state: PeerState, name: string, since?: number): string {
  if (state === "connecting") return t("Life Connect: connecting");
  if (state === "online") return `${name}: ${t("online")}`;
  if (state === "offline") {
    if (!since) return `${name}: ${t("offline")}`;
    const time = new Date(since).toLocaleTimeString(getLang() === "ar" ? "ar-EG" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${name}: ${t("offline since")} ${time}`;
  }
  return t("Life Connect");
}
