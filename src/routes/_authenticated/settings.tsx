import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/PageHeader";
import { ReminderSettingsCard } from "@/components/app/PrayerReminders";
import { UsageInsights } from "@/components/app/UsageInsights";
import { CurrencyCombobox } from "@/components/app/CurrencyCombobox";
import { DatePicker } from "@/components/app/DatePicker";
import { ErrorState, LoadingState } from "@/components/app/States";
import { UserAvatar, useDisplayName } from "@/components/app/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bodyStatsQuery, healthKeys, saveBodyStats } from "@/data/health";
import {
  DEFAULT_DIMENSION_ORDER,
  dimensionLabel,
  preferencesKeys,
  preferencesQuery,
  savePreferences,
} from "@/data/preferences";
import {
  ACCEPTED_AVATAR_TYPES,
  profileKeys,
  profileQuery,
  removeAvatar,
  updateProfile,
  uploadAvatar,
} from "@/data/profile";
import {
  ASR_SCHOOLS,
  CALC_METHODS,
  geocodeCity,
  prayerSettingsQuery,
  reverseGeocode,
  savePrayerSettings,
  spiritKeys,
} from "@/data/spirit";
import { MODULES } from "@/data/modules";
import { WEEK_START_OPTIONS } from "@/data/week";
import { useModules } from "@/hooks/useModules";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme, type ThemePreference } from "@/hooks/useTheme";
import { requestDeviceLocation } from "@/lib/geolocation";
import { financeKeys, hasPaydaySetup, paydayConfigQuery, savePaydayConfig } from "@/data/finance";
import {
  DATE_FORMATS,
  TIME_FORMATS,
  UNIT_SYSTEMS,
  cmToFtIn,
  ftInToCm,
  weightToDisplay,
  weightToStored,
} from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Profile & Settings — Life OS" },
      {
        name: "description",
        content:
          "Your name and picture, body and prayer setup, units, formats, priorities and theme.",
      },
      { property: "og:title", content: "Profile & Settings — Life OS" },
      {
        property: "og:description",
        content:
          "Your name and picture, body and prayer setup, units, formats, priorities and theme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function num(value: string): number | null {
  const parsed = Number(value);
  return value.trim() === "" || Number.isNaN(parsed) ? null : parsed;
}

function SettingsPage() {
  const queryClient = useQueryClient();
  const profile = useQuery(profileQuery());
  const preferences = useQuery(preferencesQuery());
  const body = useQuery(bodyStatsQuery());
  const prayer = useQuery(prayerSettingsQuery());
  const payday = useQuery(paydayConfigQuery());
  const { email } = useDisplayName();
  const { preference, setPreference } = useTheme();
  const { prefs, weightUnit, weekStartsOn, skin } = usePreferences();
  const { enabled: enabledModuleKeys, toggleModule, isSaving } = useModules();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [order, setOrder] = useState<string[]>(DEFAULT_DIMENSION_ORDER);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [heightFeet, setHeightFeet] = useState<number | null>(null);
  const [heightInches, setHeightInches] = useState<number | null>(null);
  const [birthdate, setBirthdate] = useState("");
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [city, setCity] = useState("");
  const [payDay, setPayDay] = useState("");
  const [expectedNet, setExpectedNet] = useState("");
  const [safetyBuffer, setSafetyBuffer] = useState("");
  const nameLoaded = useRef(false);
  const orderLoaded = useRef(false);
  const bodyLoaded = useRef(false);
  const paydayLoaded = useRef(false);

  useEffect(() => {
    if (nameLoaded.current || !profile.data) return;
    nameLoaded.current = true;
    setName(profile.data.display_name ?? "");
  }, [profile.data]);

  useEffect(() => {
    if (orderLoaded.current) return;
    const saved = preferences.data?.dimension_order;
    if (saved && saved.length > 0) {
      orderLoaded.current = true;
      setOrder(saved);
    }
  }, [preferences.data]);

  useEffect(() => {
    if (bodyLoaded.current || !body.data) return;
    bodyLoaded.current = true;
    const cm = body.data.height_cm == null ? null : Number(body.data.height_cm);
    setHeightCm(cm);
    if (cm != null) {
      const { feet, inches } = cmToFtIn(cm);
      setHeightFeet(feet);
      setHeightInches(inches);
    }
    setBirthdate(body.data.birthdate ?? "");
    const target = body.data.target_weight_kg == null ? null : Number(body.data.target_weight_kg);
    setTargetWeight(weightToDisplay(target, prefs));
  }, [body.data, prefs]);

  // Load the saved pay-day figures once, so typing is never overwritten.
  useEffect(() => {
    if (paydayLoaded.current || !payday.data) return;
    paydayLoaded.current = true;
    setPayDay(payday.data.pay_day == null ? "" : String(payday.data.pay_day));
    setExpectedNet(
      payday.data.expected_net_amount == null ? "" : String(payday.data.expected_net_amount),
    );
    setSafetyBuffer(payday.data.safety_buffer == null ? "" : String(payday.data.safety_buffer));
  }, [payday.data]);

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const invalidateProfile = () => queryClient.invalidateQueries({ queryKey: profileKeys.current });

  const saveName = useMutation({
    mutationFn: () => updateProfile({ display_name: name.trim() || null }),
    onSuccess: () => {
      invalidateProfile();
      toast.success("Display name saved.");
    },
    onError,
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => {
      invalidateProfile();
      toast.success("Profile picture updated.");
    },
    onError,
  });

  const clearPicture = useMutation({
    mutationFn: () => removeAvatar(),
    onSuccess: () => {
      invalidateProfile();
      toast.success("Profile picture removed.");
    },
    onError,
  });

  const savePrefs = useMutation({
    mutationFn: savePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: preferencesKeys.current });
      toast.success("Preferences saved.");
    },
    onError,
  });

  const saveBody = useMutation({
    mutationFn: () => {
      const cm =
        prefs.unit_system === "imperial"
          ? heightFeet == null && heightInches == null
            ? null
            : ftInToCm(heightFeet ?? 0, heightInches ?? 0)
          : heightCm;
      return saveBodyStats({
        height_cm: cm,
        birthdate: birthdate || null,
        target_weight_kg: weightToStored(targetWeight, prefs),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthKeys.body });
      toast.success("Body setup saved.");
    },
    onError,
  });

  const savePayday = useMutation({
    mutationFn: () =>
      savePaydayConfig({
        schedule: "monthly",
        pay_day: num(payDay),
        expected_net_amount: num(expectedNet),
        safety_buffer: num(safetyBuffer),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.payday });
      toast.success("Money setup saved.");
    },
    onError,
  });

  const savePrayer = useMutation({
    mutationFn: savePrayerSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: spiritKeys.settings }),
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

  const useDevice = useMutation({
    mutationFn: async () => {
      const coords = await requestDeviceLocation();
      const label = await reverseGeocode(coords.latitude, coords.longitude);
      return savePrayerSettings({ ...coords, city: label });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: spiritKeys.settings });
      toast.success(`Location set to ${data.city ?? "your device position"}.`);
    },
    onError,
  });

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const current = next[index]!;
    next[index] = next[target]!;
    next[target] = current;
    setOrder(next);
    savePrefs.mutate({ dimension_order: next });
  }

  const loading = profile.isLoading || preferences.isLoading || body.isLoading || prayer.isLoading;
  const loadError = profile.error ?? preferences.error ?? body.error ?? prayer.error;

  if (loading) {
    return (
      <>
        <PageHeader title="Profile & Settings" description="Set things up once here." />
        <LoadingState rows={4} />
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Profile & Settings" description="Set things up once here." />
        <ErrorState
          error={loadError}
          onRetry={() => {
            profile.refetch();
            preferences.refetch();
            body.refetch();
            prayer.refetch();
          }}
        />
      </>
    );
  }

  const prayerConfig = prayer.data;

  return (
    <>
      <PageHeader
        title="Profile & Settings"
        description="Everything you only set once: you, your body, your prayers, and how things look."
      />

      <div className="space-y-6">
        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
            <CardDescription>
              Your name is used across the app instead of your email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <UserAvatar size="lg" />
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={upload.isPending}
                    onClick={() => fileInput.current?.click()}
                  >
                    {upload.isPending
                      ? "Uploading…"
                      : profile.data?.avatar_url
                        ? "Replace picture"
                        : "Upload picture"}
                  </Button>
                  {profile.data?.avatar_url ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={clearPicture.isPending}
                      onClick={() => clearPicture.mutate()}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  PNG, JPEG, WebP or GIF, up to 2MB. Without a picture, your initials are shown.
                </p>
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPTED_AVATAR_TYPES.join(",")}
                  className="sr-only"
                  aria-label="Choose a profile picture"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) upload.mutate(file);
                  }}
                />
              </div>
            </div>

            <form
              className="grid gap-4 sm:max-w-md"
              onSubmit={(event) => {
                event.preventDefault();
                saveName.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  className="h-12"
                  value={name}
                  placeholder="Your name"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-email">Account email</Label>
                <Input id="account-email" value={email} readOnly disabled />
              </div>
              <div>
                <Button type="submit" className="h-12" disabled={saveName.isPending}>
                  {saveName.isPending ? "Saving…" : "Save name"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Units & formats</CardTitle>
            <CardDescription>
              These change how values are shown everywhere. Your data is always stored the same way.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Units</Label>
              <Select
                value={prefs.unit_system}
                onValueChange={(value) => savePrefs.mutate({ unit_system: value })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_SYSTEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Select
                value={prefs.time_format}
                onValueChange={(value) => savePrefs.mutate({ time_format: value })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_FORMATS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Week starts on</Label>
              <Select
                value={String(weekStartsOn)}
                onValueChange={(value) => savePrefs.mutate({ week_start: Number(value) })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEK_START_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={String(item.value)}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dates</Label>
              <Select
                value={prefs.date_format}
                onValueChange={(value) => savePrefs.mutate({ date_format: value })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Body setup</CardTitle>
            <CardDescription>
              Height, birthdate and target weight. Your current weight is logged on the Health page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveBody.mutate();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                {prefs.unit_system === "imperial" ? (
                  <div className="space-y-2 sm:col-span-1">
                    <Label htmlFor="height-ft">Height (ft / in)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="height-ft"
                        type="number"
                        inputMode="numeric"
                        className="h-12"
                        aria-label="Height feet"
                        value={heightFeet ?? ""}
                        onChange={(event) => setHeightFeet(num(event.target.value))}
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        className="h-12"
                        aria-label="Height inches"
                        value={heightInches ?? ""}
                        onChange={(event) => setHeightInches(num(event.target.value))}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="height-cm">Height (cm)</Label>
                    <Input
                      id="height-cm"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      className="h-12"
                      value={heightCm ?? ""}
                      onChange={(event) => setHeightCm(num(event.target.value))}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="birthdate">Birthdate</Label>
                  <DatePicker
                    id="birthdate"
                    value={birthdate}
                    disableFuture
                    onChange={setBirthdate}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-weight">Target weight ({weightUnit})</Label>
                  <Input
                    id="target-weight"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    className="h-12"
                    value={targetWeight ?? ""}
                    onChange={(event) => setTargetWeight(num(event.target.value))}
                  />
                </div>
              </div>
              <Button type="submit" className="h-12" disabled={saveBody.isPending}>
                {saveBody.isPending ? "Saving…" : "Save body setup"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Prayer setup</CardTitle>
            <CardDescription>
              {prayerConfig?.city
                ? `Prayer times are calculated for ${prayerConfig.city}.`
                : prayerConfig?.latitude != null
                  ? "Prayer times are calculated for your saved coordinates."
                  : "Set a location so prayer times can be calculated."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  className="h-12"
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
                  className="h-12"
                  disabled={!city.trim() || lookupCity.isPending}
                  onClick={() => lookupCity.mutate(city.trim())}
                >
                  {lookupCity.isPending ? "Looking up…" : "Use city"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  disabled={useDevice.isPending}
                  onClick={() => useDevice.mutate()}
                >
                  {useDevice.isPending ? "Locating…" : "Use my location"}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Calculation method</Label>
                <Select
                  value={prayerConfig?.calc_method ?? "MuslimWorldLeague"}
                  onValueChange={(value) => savePrayer.mutate({ calc_method: value })}
                >
                  <SelectTrigger className="h-12">
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
                  value={prayerConfig?.asr_school ?? "shafi"}
                  onValueChange={(value) => savePrayer.mutate({ asr_school: value })}
                >
                  <SelectTrigger className="h-12">
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

        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Money setup</CardTitle>
            <CardDescription>
              When you are paid and how much you want left untouched. Left empty until you fill it
              in — Life OS never guesses these.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pay-day">Pay day of the month</Label>
                <Input
                  id="pay-day"
                  type="number"
                  min="1"
                  max="31"
                  inputMode="numeric"
                  className="h-12 tabular-nums"
                  value={payDay}
                  placeholder="e.g. 28"
                  onChange={(event) => setPayDay(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expected-net">Expected net pay</Label>
                <Input
                  id="expected-net"
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-12 tabular-nums"
                  value={expectedNet}
                  onChange={(event) => setExpectedNet(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="safety-buffer">Safety buffer</Label>
                <Input
                  id="safety-buffer"
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-12 tabular-nums"
                  value={safetyBuffer}
                  onChange={(event) => setSafetyBuffer(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <CurrencyCombobox
                value={prefs.currency}
                onChange={(currency) => savePrefs.mutate({ currency })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="h-12"
                disabled={savePayday.isPending}
                onClick={() => savePayday.mutate()}
              >
                {savePayday.isPending ? "Saving…" : "Save money setup"}
              </Button>
              {!hasPaydaySetup(payday.data) ? (
                <p className="text-sm text-muted-foreground">
                  Until a pay day is saved, the Money page shows a setup prompt instead of a
                  countdown.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Dimension priority</CardTitle>
            <CardDescription>
              The order your life dimensions matter to you right now. Saved as you move them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {order.map((dimension, index) => (
                <li
                  key={dimension}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="flex items-center gap-3 text-sm">
                    <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                    {dimensionLabel(dimension)}
                  </span>
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-11"
                      aria-label={`Move ${dimensionLabel(dimension)} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-11"
                      aria-label={`Move ${dimensionLabel(dimension)} down`}
                      disabled={index === order.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Modules</CardTitle>
            <CardDescription>
              Choose which parts of Life OS you see. Switching one off hides it everywhere and never
              deletes anything you saved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {MODULES.map((module) => {
              const on = enabledModuleKeys.includes(module.key);
              return (
                <div
                  key={module.key}
                  className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{module.label}</p>
                    <p className="text-xs text-muted-foreground">{module.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">{on ? "On" : "Off"}</span>
                    <Switch
                      checked={on}
                      aria-label={`${module.label} module`}
                      disabled={isSaving}
                      onCheckedChange={(next) => toggleModule(module.key, next)}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Setup</CardTitle>
            <CardDescription>
              Walk through the first-run questions again. Nothing is cleared — you just confirm or
              change your answers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="h-12"
              disabled={savePrefs.isPending}
              onClick={() => savePrefs.mutate({ onboarding_completed_at: null })}
            >
              Run setup again
            </Button>
          </CardContent>
        </Card>

        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>
              Light uses Executive Crisp, dark uses Pro Dark. System follows your device. Remembered
              on this device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              role="radiogroup"
              aria-label="Theme"
              className="inline-flex gap-1 rounded-xl bg-secondary p-1"
            >
              {(
                [
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                  { value: "system", label: "System", icon: Monitor },
                ] as { value: ThemePreference; label: string; icon: typeof Sun }[]
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={preference === value}
                  onClick={() => setPreference(value)}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${preference === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium">Skin</p>
              <p className="text-xs text-muted-foreground">
                Same data, two ways to see it. Serious shows plain counts. RPG shows the same logs
                as XP, levels and 0–100 stats, each with how it is worked out.
              </p>
              <div
                role="radiogroup"
                aria-label="Skin"
                className="inline-flex gap-1 rounded-xl bg-secondary p-1"
              >
                {(
                  [
                    { value: "serious", label: "Serious" },
                    { value: "rpg", label: "RPG" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={skin === value}
                    onClick={() => savePrefs.mutate({ skin: value })}
                    className={`inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium transition-colors ${skin === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <ReminderSettingsCard />

        <UsageInsights />
      </div>
    </>
  );
}
