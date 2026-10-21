import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  nextClockKind,
  recordEvent,
  workKeys,
  type EventInput,
  type WorkEvent,
  type WorkMember,
  type WorkOrg,
  type WorkPlace,
} from "@/data/work/api";
import { checkPlace, type PlaceLike } from "@/data/work/place";
import type { WorkRules } from "@/data/work/rules";
import { t } from "@/lib/i18n";
import { canClockIn, workCheck, type WorkCheck } from "@/lib/native";
import { toError } from "@/lib/supabase-helpers";

type Ok = Extract<WorkCheck, { ok: true }>;

const FAILURES: Record<Extract<WorkCheck, { ok: false }>["reason"], string> = {
  cancelled: "Not confirmed, so nothing was recorded.",
  "no-lock": "Set a fingerprint or screen lock on this phone first.",
  "no-permission": "Allow location for Life OS, then tap again.",
  "no-location": "Couldn't get your location. Step outside or near a window and try again.",
  unsupported: "This phone's Android is too old for the fingerprint check.",
};

/**
 * Clock in / clock out: fingerprint (or screen lock), one location reading,
 * then the company's rule for where you are. Location is read only now.
 */
export function ClockCard({
  org,
  rules,
  member,
  places,
  today,
  recent,
}: {
  org: WorkOrg;
  rules: WorkRules;
  member: WorkMember;
  places: WorkPlace[];
  /** Today's events (yours), oldest first. */
  today: WorkEvent[];
  /** Your events from the last day or so, to tell clock-in from clock-out. */
  recent: WorkEvent[];
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ check: Ok; event: EventInput } | null>(null);
  const [reason, setReason] = useState("");
  const clocks = today.filter((event) => event.kind !== "attempt");
  const kind = nextClockKind(recent, Date.now());
  const allowed = (member.place_ids?.length
    ? places.filter((place) => member.place_ids!.includes(place.id))
    : places) as unknown as PlaceLike[];
  const placeName = (id: string | null) => places.find((place) => place.id === id)?.name ?? "";
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      timeZone: rules.timezone,
      hour: "numeric",
      minute: "2-digit",
    });

  const save = useMutation({
    mutationFn: (event: EventInput) => recordEvent(event),
    onSuccess: (_data, event) => {
      void queryClient.invalidateQueries({ queryKey: workKeys.all });
      setAsking(null);
      setReason("");
      if (event.kind === "attempt")
        setMessage(t("Not counted. Your admin can see the attempt and the reason."));
      else {
        setMessage(null);
        toast.success(event.kind === "in" ? t("Clocked in") : t("Clocked out"));
      }
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  const tap = useMutation({
    mutationFn: () => workCheck(`${t(kind === "in" ? "Clock in" : "Clock out")} · ${org.name}`),
    onSuccess: (check) => {
      if (!check.ok) {
        setMessage(t(FAILURES[check.reason]));
        return;
      }
      if (!allowed.length) {
        setMessage(t("Your company has no places yet. Ask an admin to add the office."));
        return;
      }
      const reading = {
        latitude: check.latitude,
        longitude: check.longitude,
        accuracy: check.accuracy,
      };
      const result = checkPlace(reading, allowed);
      const base: EventInput = {
        org_id: org.id,
        kind,
        at: new Date(check.at).toISOString(),
        verified: check.verified,
        latitude: check.latitude,
        longitude: check.longitude,
        accuracy_m: check.accuracy,
        mock: check.mock,
      };
      if (result.status === "unclear") {
        setMessage(t("Location isn't clear here. Step outside or near a window and try again."));
        return;
      }
      if (result.status === "inside") {
        if (check.mock)
          toast.warning(t("Your phone reported a faked location. Your admin will see that."));
        save.mutate({
          ...base,
          place_id: result.place.id,
          place_kind: result.place.kind,
          distance_m: Math.round(result.distance),
        });
        return;
      }
      const away = result.nearest
        ? `${t("You're")} ${Math.round(result.distance ?? 0)} m ${t("from")} ${result.nearest.name}.`
        : "";
      const near = {
        place_id: result.nearest?.id ?? null,
        place_kind: result.nearest?.kind ?? null,
        distance_m: result.distance == null ? null : Math.round(result.distance),
      };
      if (rules.outsideRadius === "refuse") {
        setMessage(`${away} ${t("Clock in when you're there.")}`);
        return;
      }
      setMessage(away);
      setAsking({
        check,
        event: {
          ...base,
          ...near,
          kind: rules.outsideRadius === "allowWithReason" ? kind : "attempt",
        },
      });
    },
    onError: (error: unknown) => setMessage(toError(error).message),
  });

  return (
    <section className="stat-card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold">{org.name}</p>
          <p className="text-xs text-muted-foreground">
            {clocks.length
              ? clocks
                  .map(
                    (event) =>
                      `${t(event.kind === "in" ? "In" : "Out")} ${time(event.at)}${event.place_id ? ` · ${placeName(event.place_id)}` : ""}`,
                  )
                  .join("  ·  ")
              : t("Not clocked in today.")}
          </p>
        </div>
        {canClockIn() ? (
          <Button
            type="button"
            className="h-12 px-6"
            disabled={tap.isPending || save.isPending}
            onClick={() => {
              setMessage(null);
              tap.mutate();
            }}
          >
            <Fingerprint className="size-5" />
            {t(kind === "in" ? "Clock in" : "Clock out")}
          </Button>
        ) : (
          <p className="max-w-56 text-xs text-muted-foreground">
            {t("Clock in from the Life OS app on your phone (fingerprint and location).")}
          </p>
        )}
      </div>

      {message ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {message}
        </p>
      ) : null}

      {asking ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim()) save.mutate({ ...asking.event, reason: reason.trim() });
          }}
        >
          <Input
            autoFocus
            value={reason}
            maxLength={300}
            placeholder={t("Why here? (e.g. at the client's office)")}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!reason.trim() || save.isPending}>
              {asking.event.kind === "attempt"
                ? t("Send to my admin")
                : t(kind === "in" ? "Clock in" : "Clock out")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <p className="text-2xs text-muted-foreground">
        {t(
          "Your location is read only when you clock in or out. Your fingerprint never leaves the phone.",
        )}
      </p>
    </section>
  );
}
