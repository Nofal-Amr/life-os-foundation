import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from "adhan";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ASR_SCHOOLS,
  CALC_METHODS,
  PRAYER_LABELS,
  PRAYER_NAMES,
  clearPrayerLog,
  geocodeCity,
  logPrayer,
  prayerLogsQuery,
  prayerSettingsQuery,
  savePrayerSettings,
  spiritKeys,
  type PrayerName,
} from "@/data/spirit";
import { todayISO } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/spirit")({
  head: () => ({
    meta: [
      { title: "Spirit — Life OS" },
      {
        name: "description",
        content: "Today's prayer times for your location, with a simple record of each prayer.",
      },
      { property: "og:title", content: "Spirit — Life OS" },
      {
        property: "og:description",
        content: "Today's prayer times for your location, with a simple record of each prayer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpiritPage,
});

type MethodKey = keyof typeof CalculationMethod;

function buildTimes(
  latitude: number,
  longitude: number,
  method: string | null,
  asrSchool: string | null,
) {
  const key = (method && method in CalculationMethod ? method : "MuslimWorldLeague") as MethodKey;
  const factory = CalculationMethod[key] as () => ReturnType<
    typeof CalculationMethod.MuslimWorldLeague
  >;
  const params = factory();
  params.madhab = asrSchool === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  return new PrayerTimes(new Coordinates(latitude, longitude), new Date(), params);
}

function lastSevenDates(): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return format(date, "yyyy-MM-dd");
  });
}

function SpiritPage() {
  const queryClient = useQueryClient();
  const settings = useQuery(prayerSettingsQuery());
  const logs = useQuery(prayerLogsQuery());
  const today = todayISO();

  const [city, setCity] = useState("");

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const saveSettings = useMutation({
    mutationFn: savePrayerSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: spiritKeys.settings }),
    onError,
  });

  const setLog = useMutation({
    mutationFn: (input: {
      prayer_name: PrayerName;
      completed: boolean;
      on_time: boolean | null;
    }) => logPrayer({ prayer_date: today, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: spiritKeys.logs }),
    onError,
  });

  const unsetLog = useMutation({
    mutationFn: (prayer_name: PrayerName) => clearPrayerLog(today, prayer_name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: spiritKeys.logs }),
    onError,
  });

  const lookupCity = useMutation({
    mutationFn: async (value: string) => {
      const place = await geocodeCity(value);
      return savePrayerSettings({
        latitude: place.latitude,
        longitude: place.longitude,
        city: place.label,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: spiritKeys.settings });
      setCity("");
      toast.success(`Location set to ${data.city}.`);
    },
    onError,
  });

  function useDeviceLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("This device cannot share its location. Enter a city instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        saveSettings.mutate(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          { onSuccess: () => toast.success("Location saved from your device.") },
        );
      },
      () => toast.error("Location permission was declined. Enter a city instead."),
    );
  }

  if (settings.isLoading || logs.isLoading) {
    return (
      <>
        <PageHeader title="Spirit" description="Today's prayer times and your own record." />
        <LoadingState rows={4} />
      </>
    );
  }

  if (settings.error || logs.error) {
    return (
      <>
        <PageHeader title="Spirit" description="Today's prayer times and your own record." />
        <ErrorState
          error={settings.error ?? logs.error}
          onRetry={() => {
            settings.refetch();
            logs.refetch();
          }}
        />
      </>
    );
  }

  const config = settings.data;
  const hasLocation = config?.latitude != null && config?.longitude != null;
  const times = hasLocation
    ? buildTimes(Number(config.latitude), Number(config.longitude), config.calc_method, config.asr_school)
    : null;
  const next = times?.nextPrayer();
  const nextName = times && next ? String(next).toLowerCase() : null;

  const todayLogs = (logs.data ?? []).filter((log) => log.prayer_date === today);
  const weekDates = new Set(lastSevenDates());
  const weekLogged = (logs.data ?? []).filter(
    (log) => weekDates.has(log.prayer_date) && log.completed,
  ).length;

  const locationCard = (
    <Card className="system-card">
      <CardHeader>
        <CardTitle className="text-base">Location & calculation</CardTitle>
        <CardDescription>
          {config?.city
            ? `Times are calculated for ${config.city}.`
            : hasLocation
              ? "Times are calculated for your saved coordinates."
              : "Set a location so prayer times can be calculated."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              placeholder="e.g. Manchester"
              onChange={(event) => setCity(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && city.trim()) {
                  event.preventDefault();
                  lookupCity.mutate(city.trim());
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={!city.trim() || lookupCity.isPending}
              onClick={() => lookupCity.mutate(city.trim())}
            >
              {lookupCity.isPending ? "Looking up…" : "Use city"}
            </Button>
            <Button type="button" variant="outline" onClick={useDeviceLocation}>
              Use my location
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Calculation method</Label>
            <Select
              value={config?.calc_method ?? "MuslimWorldLeague"}
              onValueChange={(value) => saveSettings.mutate({ calc_method: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CALC_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Asr school</Label>
            <Select
              value={config?.asr_school ?? "shafi"}
              onValueChange={(value) => saveSettings.mutate({ asr_school: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASR_SCHOOLS.map((school) => (
                  <SelectItem key={school.value} value={school.value}>
                    {school.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Spirit"
        description={`Today's prayer times and your own record — ${format(new Date(), "EEEE, d MMMM")}.`}
      />

      <div className="space-y-6">
        {!hasLocation ? (
          <EmptyState
            title="No location set yet"
            description="Share your location or enter a city below to see today's prayer times."
          />
        ) : (
          <Card className="system-card">
            <CardHeader>
              <CardTitle className="text-base">Today</CardTitle>
              <CardDescription>
                {weekLogged} of 35 prayers logged over the last seven days.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {PRAYER_NAMES.map((name) => {
                const time = times ? (times[name] as Date) : null;
                const log = todayLogs.find((item) => item.prayer_name === name);
                const isNext = nextName === name;
                return (
                  <div
                    key={name}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-20 text-sm font-medium">{PRAYER_LABELS[name]}</span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {time ? format(time, "HH:mm") : "—"}
                      </span>
                      {isNext ? (
                        <Badge variant="secondary" className="uppercase">
                          Next
                        </Badge>
                      ) : null}
                      {log?.completed ? (
                        <Badge variant="outline">
                          {log.on_time === true ? "On time" : log.on_time === false ? "Late" : "Logged"}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={log?.on_time === true ? "default" : "outline"}
                        onClick={() =>
                          setLog.mutate({ prayer_name: name, completed: true, on_time: true })
                        }
                      >
                        On time
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={log?.on_time === false ? "default" : "outline"}
                        onClick={() =>
                          setLog.mutate({ prayer_name: name, completed: true, on_time: false })
                        }
                      >
                        Late
                      </Button>
                      {log ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => unsetLog.mutate(name)}
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {locationCard}
      </div>
    </>
  );
}
