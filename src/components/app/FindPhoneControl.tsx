import { Flashlight, Square, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { findTarget, lifeConnect, type ConnectRole } from "@/lib/native";

type Sent = "find" | "stop" | "failed" | null;

/**
 * Find my phone, from the other phone: it rings loudly (even on silent) and/or
 * flashes its light for a minute, or until Stop or someone picks it up.
 */
export function FindPhoneControl({
  role,
  peer,
  connected,
}: {
  role: Exclude<ConnectRole, "off">;
  peer?: string | undefined;
  connected: boolean;
}) {
  const [ring, setRing] = useState(true);
  const [flash, setFlash] = useState(false);
  const [sent, setSent] = useState<Sent>(null);
  const target = findTarget(role, peer);

  useEffect(() => {
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<{ kind: "find" | "stop"; ok: boolean }>).detail;
      setSent(detail?.ok ? detail.kind : "failed");
    };
    window.addEventListener("life-os-connect-find", onResult);
    return () => window.removeEventListener("life-os-connect-find", onResult);
  }, []);

  return (
    <div className="space-y-3 rounded-lg bg-secondary p-3">
      <div>
        <p className="text-sm font-medium">Find {target}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          It rings or flashes for a minute, and stops when someone picks it up. It rings even on
          silent or vibrate. With Do Not Disturb on, it rings only if alarms are allowed there.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="find-ring" className="flex items-center gap-2">
          <Volume2 className="size-4" aria-hidden="true" /> Ring loudly
        </Label>
        <Switch id="find-ring" checked={ring} onCheckedChange={setRing} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="find-flash" className="flex items-center gap-2">
          <Flashlight className="size-4" aria-hidden="true" /> Flash
        </Label>
        <Switch id="find-flash" checked={flash} onCheckedChange={setFlash} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!connected || (!ring && !flash)}
          onClick={() => {
            setSent(null);
            lifeConnect.find({ ring, flash });
          }}
        >
          Find {target}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!connected}
          onClick={() => {
            setSent(null);
            lifeConnect.stopFind();
          }}
        >
          <Square className="size-3.5" aria-hidden="true" /> Stop
        </Button>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {!connected
          ? "Waiting for the connection to the relay."
          : sent === "find"
            ? "Sent."
            : sent === "stop"
              ? "Sent. It stops now."
              : sent === "failed"
                ? "Couldn't reach the relay. Check this phone's internet."
                : null}
      </p>
    </div>
  );
}
