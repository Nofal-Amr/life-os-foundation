import { Link } from "@tanstack/react-router";
import { Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { peerName, peerState, peerStateLabel } from "@/lib/connectPeer";
import { t } from "@/lib/i18n";
import { lifeConnect, type ConnectStatus } from "@/lib/native";

/**
 * Header button beside your picture (phone app only, while Life Connect is set
 * up): one tap to Life Connect. A filled dot means the other phone is online,
 * a ring that it isn't; the label says it in words.
 */
export function ConnectShortcut() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);

  useEffect(() => {
    if (!lifeConnect.available()) return;
    const refresh = () => setStatus(lifeConnect.status());
    refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("life-os-connect", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("life-os-connect", refresh);
    };
  }, []);

  if (!status || status.role === "off") return null;
  const state = peerState(status);
  const label = peerStateLabel(state, t(peerName(status)), status.peerLink?.since);

  return (
    <Link
      to="/settings"
      search={{ section: "phone" }}
      aria-label={label}
      title={label}
      className="relative flex size-10 items-center justify-center rounded-full transition-transform duration-150 ease-out hover:bg-accent active:scale-95"
    >
      <Smartphone className="size-5" aria-hidden="true" />
      {state === "online" ? (
        <span
          className="absolute right-2 top-2 size-2 rounded-full bg-foreground"
          aria-hidden="true"
        />
      ) : state === "offline" || state === "connecting" ? (
        <span
          className="absolute right-2 top-2 size-2 rounded-full border border-foreground bg-background"
          aria-hidden="true"
        />
      ) : null}
    </Link>
  );
}
