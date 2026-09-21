import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CurrencyCombobox } from "@/components/app/CurrencyCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { financeKeys, paydayConfigQuery, savePaydayConfig } from "@/data/finance";
import { ALL_MODULE_KEYS, MODULES } from "@/data/modules";
import { preferencesKeys, preferencesQuery, savePreferences } from "@/data/preferences";
import { profileKeys, profileQuery, updateProfile } from "@/data/profile";
import {
  ASR_SCHOOLS,
  CALC_METHODS,
  geocodeCity,
  prayerSettingsQuery,
  reverseGeocode,
  savePrayerSettings,
  spiritKeys,
} from "@/data/spirit";
import { createTask, taskKeys } from "@/data/tasks";
import { requestDeviceLocation } from "@/lib/geolocation";

type StepKey = "name" | "modules" | "money" | "spirit" | "first";

function numberOrNull(value: string): number | null {
  const parsed = Number(value);
  return value.trim() === "" || Number.isNaN(parsed) ? null : parsed;
}

/**
 * First-run setup. Every step is skippable, each step saves as it is left, and
 * closing the app resumes here until it is finished. No data is invented.
 */
export function Onboarding() {
  const queryClient = useQueryClient();
  const profile = useQuery(profileQuery());
  const preferences = useQuery(preferencesQuery());
  const payday = useQuery(paydayConfigQuery());
  const prayer = useQuery(prayerSettingsQuery());

  const [name, setName] = useState("");
  const [modules, setModules] = useState<string[]>(ALL_MODULE_KEYS);
  const [currency, setCurrency] = useState<string | null>(null);
  const [payDay, setPayDay] = useState("");
  const [expectedNet, setExpectedNet] = useState("");
  const [safetyBuffer, setSafetyBuffer] = useState("");
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [method, setMethod] = useState("MuslimWorldLeague");
  const [school, setSchool] = useState("shafi");
  const [locating, setLocating] = useState(false);
  const [firstThing, setFirstThing] = useState("");
  const [index, setIndex] = useState(0);

  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    if (profile.isLoading || preferences.isLoading || payday.isLoading || prayer.isLoading) return;
    hydrated.current = true;
    setName(profile.data?.display_name ?? "");
    if (preferences.data?.enabled_modules?.length) setModules(preferences.data.enabled_modules);
    setCurrency(preferences.data?.currency ?? null);
    setPayDay(payday.data?.pay_day != null ? String(payday.data.pay_day) : "");
    setExpectedNet(
      payday.data?.expected_net_amount != null ? String(payday.data.expected_net_amount) : "",
    );
    setSafetyBuffer(
      payday.data?.safety_buffer != null ? String(payday.data.safety_buffer) : "",
    );
    setCity(prayer.data?.city ?? "");
    if (prayer.data?.latitude != null && prayer.data?.longitude != null) {
      setCoords({ latitude: Number(prayer.data.latitude), longitude: Number(prayer.data.longitude) });
    }
    if (prayer.data?.calc_method) setMethod(prayer.data.calc_method);
    if (prayer.data?.asr_school) setSchool(prayer.data.asr_school);
  }, [profile, preferences, payday, prayer]);

  const steps: StepKey[] = [
    "name",
    "modules",
    ...(modules.includes("money") ? (["money"] as StepKey[]) : []),
    ...(modules.includes("spirit") ? (["spirit"] as StepKey[]) : []),
    "first",
  ];
  const step = steps[Math.min(index, steps.length - 1)] ?? "name";

  const finish = useMutation({
    mutationFn: async () => {
      await savePreferences({ onboarding_completed_at: new Date().toISOString() });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: preferencesKeys.current }),
    onError: (error: Error) => toast.error(error.message),
  });

  const advance = useMutation({
    mutationFn: async (save: boolean) => {
      if (save) {
        if (step === "name" && name.trim()) {
          await updateProfile({ display_name: name.trim() });
          await queryClient.invalidateQueries({ queryKey: profileKeys.current });
        }
        if (step === "modules") {
          await savePreferences({ enabled_modules: modules.length ? modules : ALL_MODULE_KEYS });
          await queryClient.invalidateQueries({ queryKey: preferencesKeys.current });
        }
        if (step === "money") {
          await savePreferences({ currency });
          const pay_day = numberOrNull(payDay);
          const expected_net_amount = numberOrNull(expectedNet);
          const safety_buffer = numberOrNull(safetyBuffer);
          if (pay_day != null || expected_net_amount != null || safety_buffer != null) {
            await savePaydayConfig({
              schedule: "monthly",
              pay_day,
              expected_net_amount,
              safety_buffer,
            });
          }
          await queryClient.invalidateQueries({ queryKey: preferencesKeys.current });
          await queryClient.invalidateQueries({ queryKey: financeKeys.payday });
        }
        if (step === "spirit" && coords) {
          await savePrayerSettings({
            latitude: coords.latitude,
            longitude: coords.longitude,
            city: city.trim() || null,
            calc_method: method,
            asr_school: school,
          });
          await queryClient.invalidateQueries({ queryKey: spiritKeys.settings });
        }
        if (step === "first" && firstThing.trim()) {
          await createTask({
            title: firstThing.trim(),
            description: null,
            status: "todo",
            priority: "medium",
            due_date: null,
            project_id: null,
            capability_id: null,
            goal_id: null,
          });
          await queryClient.invalidateQueries({ queryKey: taskKeys.all });
        }
      }
      return step === steps[steps.length - 1];
    },
    onSuccess: (last) => {
      if (last) finish.mutate();
      else setIndex((current) => current + 1);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function useMyLocation() {
    setLocating(true);
    try {
      const position = await requestDeviceLocation();
      setCoords(position);
      setCity(await reverseGeocode(position.latitude, position.longitude));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not get your location.");
    } finally {
      setLocating(false);
    }
  }

  async function lookUpCity() {
    if (!city.trim()) return;
    setLocating(true);
    try {
      const found = await geocodeCity(city.trim());
      setCoords({ latitude: found.latitude, longitude: found.longitude });
      setCity(found.label);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not find that place.");
    } finally {
      setLocating(false);
    }
  }

  const busy = advance.isPending || finish.isPending;
  const lastStep = step === steps[steps.length - 1];

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 py-6">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Step {Math.min(index, steps.length - 1) + 1} of {steps.length}
        </p>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto min-h-11 px-2 text-xs text-muted-foreground"
          disabled={busy}
          onClick={() => finish.mutate()}
        >
          Skip setup
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-8">
        {step === "name" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">What should we call you?</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Used across the app instead of your email.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-name">Your name</Label>
              <Input
                id="setup-name"
                className="h-12"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="First name is enough"
              />
            </div>
          </div>
        )}

        {step === "modules" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">What do you want to track?</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Everything is on. Switch off what you do not need. You can change this any time.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {MODULES.map((module) => {
                const on = modules.includes(module.key);
                return (
                  <button
                    key={module.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setModules((current) =>
                        current.includes(module.key)
                          ? current.filter((item) => item !== module.key)
                          : [...current, module.key],
                      )
                    }
                    className={`flex min-h-20 flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors ${
                      on ? "border-primary bg-accent" : "border-border bg-card"
                    }`}
                  >
                    <span className="flex w-full items-center justify-between gap-2 text-sm font-medium text-foreground">
                      {module.label}
                      <span className="text-xs font-normal text-muted-foreground">
                        {on ? (
                          <span className="flex items-center gap-1">
                            <Check className="size-3.5" aria-hidden="true" />
                            On
                          </span>
                        ) : (
                          "Off"
                        )}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">{module.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "money" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Money basics</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                All optional. Anything you leave blank stays blank; no figure is guessed.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <CurrencyCombobox value={currency} onChange={setCurrency} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="setup-payday">Pay day of the month</Label>
                <Input
                  id="setup-payday"
                  type="number"
                  min="1"
                  max="31"
                  inputMode="numeric"
                  className="h-12 tabular-nums"
                  value={payDay}
                  onChange={(event) => setPayDay(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-net">Expected net pay</Label>
                <Input
                  id="setup-net"
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-12 tabular-nums"
                  value={expectedNet}
                  onChange={(event) => setExpectedNet(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-buffer">Safety buffer</Label>
                <Input
                  id="setup-buffer"
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-12 tabular-nums"
                  value={safetyBuffer}
                  onChange={(event) => setSafetyBuffer(event.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {step === "spirit" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Where do you pray?</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Prayer times need a real location to be correct, so nothing is set until you choose
                one.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-city">City</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="setup-city"
                  className="h-12 min-w-40 flex-1"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="e.g. Cairo"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  disabled={locating || !city.trim()}
                  onClick={lookUpCity}
                >
                  Find
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  disabled={locating}
                  onClick={useMyLocation}
                >
                  <MapPin className="size-4" aria-hidden="true" />
                  Use my location
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {coords
                  ? `Location set: ${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`
                  : "No location set yet."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Calculation method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CALC_METHODS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Asr school</Label>
                <Select value={school} onValueChange={setSchool}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASR_SCHOOLS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === "first" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                One thing you want to get done?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                It becomes your first task. Leave it blank if you would rather start empty.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-first">First task</Label>
              <Input
                id="setup-first"
                className="h-12"
                value={firstThing}
                onChange={(event) => setFirstThing(event.target.value)}
                placeholder="Anything at all"
              />
            </div>
          </div>
        )}
      </main>

      <footer className="mx-auto flex w-full max-w-xl flex-wrap items-center gap-2 pb-4">
        <Button
          type="button"
          size="lg"
          className="min-h-12 flex-1"
          disabled={busy}
          onClick={() => advance.mutate(true)}
        >
          {busy ? "Saving…" : lastStep ? "Finish setup" : "Continue"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="min-h-12"
          disabled={busy}
          onClick={() => advance.mutate(false)}
        >
          Skip this step
        </Button>
        {index > 0 ? (
          <Button
            type="button"
            variant="link"
            className="min-h-12 text-xs text-muted-foreground"
            disabled={busy}
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
          >
            Back
          </Button>
        ) : null}
      </footer>
    </div>
  );
}
