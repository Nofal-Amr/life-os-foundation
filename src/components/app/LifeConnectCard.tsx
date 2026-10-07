import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, PhoneCall, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { preferencesKeys, preferencesQuery, savePreferences } from "@/data/preferences";
import { supabase } from "@/integrations/supabase/client";
import { lifeConnect, type ConnectRole, type ConnectStatus } from "@/lib/native";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

/** Per phone: which role this phone plays, and what to call it. */
const ROLE_KEY = "life-connect:role";
const NAME_KEY = "life-connect:device";

function readLocal(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Kept for this session only.
  }
}

function newSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const client = supabase as unknown as { supabaseUrl: string | URL; supabaseKey: string };

/**
 * Life Connect: a phone with the SIM card hands its incoming calls to your
 * main phone, which rings with Decline and Mute — for people who carry one
 * phone and keep their number in another. Android app only.
 */
export function LifeConnectCard() {
  const queryClient = useQueryClient();
  const preferences = useQuery(preferencesQuery());
  const [role, setRole] = useState<ConnectRole>("off");
  const [device, setDevice] = useState("SIM phone");
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const available = lifeConnect.available();

  useEffect(() => {
    const saved = readLocal(ROLE_KEY, "off");
    setRole(saved === "sim" || saved === "main" ? saved : "off");
    setDevice(readLocal(NAME_KEY, "SIM phone"));
  }, []);

  // Keep the phone's native settings in step with the role and the account key.
  const secret = preferences.data?.connect_key ?? null;
  useEffect(() => {
    if (!available || preferences.isLoading) return;
    lifeConnect.configure({
      role: secret ? role : "off",
      secret,
      url: String(client.supabaseUrl).replace(/\/$/, ""),
      anonKey: client.supabaseKey,
      device: device.trim() || "SIM phone",
    });
    setStatus(lifeConnect.status());
  }, [available, role, secret, device, preferences.isLoading]);

  useEffect(() => {
    if (!available) return;
    const refresh = () => setStatus(lifeConnect.status());
    const timer = window.setInterval(refresh, 2000);
    const onTest = (event: Event) => {
      const ok = (event as CustomEvent<boolean>).detail;
      if (ok) toast.success('Sent. Your other phone should show "Life Connect works".');
      else toast.error("Couldn't reach the relay. Check this phone's internet.");
    };
    window.addEventListener("life-os-connect", refresh);
    window.addEventListener("life-os-connect-test", onTest);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("life-os-connect", refresh);
      window.removeEventListener("life-os-connect-test", onTest);
    };
  }, [available]);

  async function choose(next: ConnectRole) {
    setRole(next);
    writeLocal(ROLE_KEY, next);
    if (next === "off") return;
    if (!secret) {
      try {
        await savePreferences({ connect_key: newSecret() });
        await queryClient.invalidateQueries({ queryKey: preferencesKeys.current });
      } catch (error) {
        toast.error(toError(error).message);
        return;
      }
    }
    // Let the native side save the role first, then ask for what it needs.
    window.setTimeout(() => lifeConnect.requestPermissions(), 300);
  }

  if (!available) {
    return (
      <section className="stat-card space-y-2 p-5">
        <p className="flex items-center gap-2 text-base font-semibold">
          <PhoneCall className="size-4" /> Life Connect
        </p>
        <p className="text-sm text-muted-foreground">
          Calls to a phone with your SIM card ring on your main phone. It runs in the Life OS
          Android app, on both phones.
        </p>
      </section>
    );
  }

  const checks: { label: string; ok: boolean; fix?: () => void }[] =
    role === "sim"
      ? [
          { label: "See incoming calls", ok: !!status?.phone, fix: lifeConnect.requestPermissions },
          {
            label: "See the caller's number",
            ok: !!status?.callLog,
            fix: lifeConnect.requestPermissions,
          },
          {
            label: "Decline from the other phone",
            ok: !!status?.answer,
            fix: lifeConnect.requestPermissions,
          },
          {
            label: "Show contact names",
            ok: !!status?.contacts,
            fix: lifeConnect.requestPermissions,
          },
        ]
      : role === "main"
        ? [
            {
              label: "Notifications",
              ok: !!status?.notifications,
              fix: lifeConnect.requestPermissions,
            },
          ]
        : [];
  if (role !== "off") {
    checks.push(
      {
        label: "Keeps working while the phone sleeps",
        ok: !!status?.battery,
        fix: lifeConnect.openBatterySettings,
      },
      { label: "Connected to the relay", ok: !!status?.connected },
    );
  }

  return (
    <section className="stat-card space-y-4 p-5">
      <div>
        <p className="flex items-center gap-2 text-base font-semibold">
          <PhoneCall className="size-4" /> Life Connect
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Calls to the phone with your SIM card ring on your main phone, with Decline and Mute. You
          answer on the SIM phone. Set this up on both phones, signed in to this account.
        </p>
      </div>

      <div
        className="flex gap-1 rounded-lg bg-secondary p-1"
        role="radiogroup"
        aria-label="This phone"
      >
        {(
          [
            { value: "off", label: "Off" },
            { value: "sim", label: "Has the SIM" },
            { value: "main", label: "Rings here" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={role === option.value}
            onClick={() => void choose(option.value)}
            className={cn(
              "min-h-10 flex-1 rounded-md px-2 text-sm font-medium transition-colors",
              role === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {role === "sim" ? (
        <div className="space-y-2">
          <Label htmlFor="connect-device">Call this phone</Label>
          <Input
            id="connect-device"
            className="h-11"
            value={device}
            maxLength={40}
            onChange={(event) => {
              setDevice(event.target.value);
              writeLocal(NAME_KEY, event.target.value);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Shown on the main phone: "Calling {device || "SIM phone"}".
          </p>
        </div>
      ) : null}

      {checks.length ? (
        <ul className="space-y-2 text-sm">
          {checks.map((check) => (
            <li key={check.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full",
                    check.ok
                      ? "bg-primary/20 text-foreground"
                      : "bg-secondary text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {check.ok ? <Check className="size-3.5" /> : null}
                </span>
                {check.label}
              </span>
              {!check.ok && check.fix ? (
                <Button type="button" size="sm" variant="outline" onClick={check.fix}>
                  Allow
                </Button>
              ) : !check.ok ? (
                <span className="text-xs text-muted-foreground">Connecting…</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {role !== "off" ? (
        <Button type="button" variant="outline" onClick={() => lifeConnect.test()}>
          <Send className="size-4" /> Send a test to the other phone
        </Button>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Only who's calling crosses the internet, encrypted with a key only your phones have. Nothing
        about your calls is stored.
      </p>
    </section>
  );
}
