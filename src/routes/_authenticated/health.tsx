import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BedDouble, Check, Pill, Plus, Scale, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AreaHabits } from "@/components/app/AreaHabits";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DateNav } from "@/components/app/DateNav";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { SamsungHealthCard } from "@/components/app/SamsungHealthCard";
import { QuickMeals } from "@/components/app/QuickMeals";
import { healthSamplesQuery, withSampleDays } from "@/data/healthSamples";
import { SemanticBadge } from "@/components/app/SemanticBadge";
import {
  GlanceSection,
  LatestValueCard,
  NotEnoughData,
  RangeToggle,
  RingStat,
  StatCard,
  TrendLine,
} from "@/components/app/StatCards";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  FOOD_CATEGORIES,
  bmi,
  bodyStatsQuery,
  createMedication,
  deleteMedication,
  healthKeys,
  healthLogsQuery,
  medicationLogsQuery,
  medicationsQuery,
  saveBodyStats,
  saveHealthLog,
  setDoseTaken,
  updateMedication,
  type HealthLogInput,
  type Medication,
  type MedicationInput,
} from "@/data/health";
import { dosesOn, hasEnoughPoints, healthSeries } from "@/data/stats";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import {
  formatDuration,
  joinDuration,
  splitDuration,
  weightToDisplay,
  weightToStored,
} from "@/lib/format";
import { scaleTone } from "@/lib/semantics";

export const Route = createFileRoute("/_authenticated/health")({
  head: () => ({
    meta: [
      { title: "Health · Life OS" },
      {
        name: "description",
        content: "A fast daily health log, your weight, and your own medication schedule.",
      },
      { property: "og:title", content: "Health · Life OS" },
      {
        property: "og:description",
        content: "A fast daily health log, your weight, and your own medication schedule.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HealthPage,
});

const emptyMedication: MedicationInput = {
  name: "",
  dosage: null,
  schedule_times: null,
  notes: null,
  active: true,
};

function emptyLog(date: string): HealthLogInput {
  return {
    log_date: date,
    trained: null,
    sleep_hours: null,
    stress_level: null,
    water_ok: null,
    food_quality: null,
    food_categories: null,
    mood: null,
    note: null,
    sleep_score: null,
    sleep_source: null,
    sleep_start_at: null,
    sleep_end_at: null,
    time_in_bed_minutes: null,
    actual_sleep_minutes: null,
    deep_sleep_minutes: null,
    rem_sleep_minutes: null,
    light_sleep_minutes: null,
    awake_minutes: null,
    sleep_latency_minutes: null,
    blood_oxygen_avg: null,
    heart_rate_avg: null,
    respiratory_rate_avg: null,
  };
}

function num(value: string): number | null {
  const parsed = Number(value);
  return value.trim() === "" || Number.isNaN(parsed) ? null : parsed;
}

/** "HH:mm" for a stored timestamp, in the reader's own time. */
function timeOf(value?: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function timeToISO(date: string, time: string): string | null {
  if (!time) return null;
  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** A single figure typed in as hours + minutes, stored as minutes. */
function DurationField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null | undefined;
  onChange: (next: number | null) => void;
}) {
  const parts = splitDuration(value);
  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-hours`}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={`${id}-hours`}
          type="number"
          inputMode="numeric"
          min="0"
          aria-label={`${label} hours`}
          className="h-12 w-20 text-base tabular-nums"
          value={parts.hours ?? ""}
          onChange={(event) => onChange(joinDuration(num(event.target.value), parts.minutes))}
        />
        <span className="text-sm text-muted-foreground">h</span>
        <Input
          id={`${id}-minutes`}
          type="number"
          inputMode="numeric"
          min="0"
          max="59"
          aria-label={`${label} minutes`}
          className="h-12 w-20 text-base tabular-nums"
          value={parts.minutes ?? ""}
          onChange={(event) => onChange(joinDuration(parts.hours, num(event.target.value)))}
        />
        <span className="text-sm text-muted-foreground">m</span>
      </div>
    </div>
  );
}

/** A plain number field with no interpretation attached. */
function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  step = "1",
}: {
  id: string;
  label: string;
  value: number | null | undefined;
  onChange: (next: number | null) => void;
  suffix?: string;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode={step === "1" ? "numeric" : "decimal"}
          step={step}
          min="0"
          className="h-12 w-28 text-base tabular-nums"
          value={value ?? ""}
          onChange={(event) => onChange(num(event.target.value))}
        />
        {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}

/** What 1 and 5 mean, in your own terms. */
const SCALE_ENDS: Record<"stress" | "mood" | "food", [string, string]> = {
  stress: ["1 · calm", "5 · very stressed"],
  mood: ["1 · low", "5 · great"],
  food: ["1 · didn't eat well", "5 · ate well"],
};

function ScaleRow({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  kind: "stress" | "mood" | "food";
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        {value != null ? (
          <SemanticBadge tone={scaleTone(kind, value)}>{value} of 5</SemanticBadge>
        ) : null}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={value === level}
            aria-label={`${label} ${level} of 5`}
            className={`h-12 flex-1 rounded-xl border text-sm font-medium tabular-nums transition-colors ${
              value === level
                ? `${
                    scaleTone(kind, level) === "danger"
                      ? "tone-danger"
                      : scaleTone(kind, level) === "warning"
                        ? "tone-warning"
                        : scaleTone(kind, level) === "positive"
                          ? "tone-positive"
                          : "tone-neutral"
                  } ring-2 ring-ring/40`
                : "border-border text-muted-foreground hover:bg-accent/50"
            }`}
            onClick={() => onChange(value === level ? null : level)}
          >
            {level}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{SCALE_ENDS[kind][0]}</span>
        <span>{SCALE_ENDS[kind][1]}</span>
      </div>
    </div>
  );
}

function HealthPage() {
  const queryClient = useQueryClient();
  const body = useQuery(bodyStatsQuery());
  const logs = useQuery(healthLogsQuery());
  // Samsung Health nights fill in days you didn't log by hand.
  const samples = useQuery(healthSamplesQuery(365));
  const medications = useQuery(medicationsQuery());
  const doses = useQuery(medicationLogsQuery());
  const { prefs, fmtDate, fmtLongDate, fmtSlot, fmtHeight, fmtShortDate, fmtWeight, weightUnit } =
    usePreferences();

  const [date, setDate] = useState(todayISO());
  const [sleepDetail, setSleepDetail] = useState(false);
  const [sleepDays, setSleepDays] = useState<14 | 30>(30);

  // Land on the named block when arriving from a link such as /health#medications.
  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [medications.data, logs.data]);

  const [weightInput, setWeightInput] = useState<number | null>(null);
  const weightLoaded = useRef(false);
  const [logForm, setLogForm] = useState<HealthLogInput>(emptyLog(date));
  const loadedLogDate = useRef<string | null>(null);

  const [medDialog, setMedDialog] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [medForm, setMedForm] = useState<MedicationInput>(emptyMedication);
  const [medTimes, setMedTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState("");
  const [toDelete, setToDelete] = useState<Medication | null>(null);

  /** Initialise the weight field once per loaded record — never mid-edit. */
  useEffect(() => {
    if (weightLoaded.current || !body.data) return;
    weightLoaded.current = true;
    const stored = body.data.weight_kg == null ? null : Number(body.data.weight_kg);
    setWeightInput(weightToDisplay(stored, prefs));
  }, [body.data, prefs]);

  /** Load the selected day's entry once per date — never while typing. */
  useEffect(() => {
    if (!logs.data || loadedLogDate.current === date) return;
    loadedLogDate.current = date;
    const entry = logs.data.find((log) => log.log_date === date);
    setLogForm(
      entry
        ? {
            log_date: entry.log_date,
            trained: entry.trained,
            sleep_hours: entry.sleep_hours == null ? null : Number(entry.sleep_hours),
            stress_level: entry.stress_level,
            water_ok: entry.water_ok,
            food_quality: entry.food_quality,
            food_categories: entry.food_categories,
            mood: entry.mood,
            note: entry.note,
            sleep_score: entry.sleep_score,
            sleep_source: entry.sleep_source,
            sleep_start_at: entry.sleep_start_at,
            sleep_end_at: entry.sleep_end_at,
            time_in_bed_minutes: entry.time_in_bed_minutes,
            actual_sleep_minutes: entry.actual_sleep_minutes,
            deep_sleep_minutes: entry.deep_sleep_minutes,
            rem_sleep_minutes: entry.rem_sleep_minutes,
            light_sleep_minutes: entry.light_sleep_minutes,
            awake_minutes: entry.awake_minutes,
            sleep_latency_minutes: entry.sleep_latency_minutes,
            blood_oxygen_avg:
              entry.blood_oxygen_avg == null ? null : Number(entry.blood_oxygen_avg),
            heart_rate_avg: entry.heart_rate_avg == null ? null : Number(entry.heart_rate_avg),
            respiratory_rate_avg:
              entry.respiratory_rate_avg == null ? null : Number(entry.respiratory_rate_avg),
          }
        : emptyLog(date),
    );
  }, [logs.data, date]);

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const saveWeight = useMutation({
    mutationFn: () => saveBodyStats({ weight_kg: weightToStored(weightInput, prefs) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthKeys.body });
      toast.success("Weight saved.");
    },
    onError,
  });

  const saveLog = useMutation({
    mutationFn: () => saveHealthLog({ ...logForm, log_date: date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthKeys.logs });
      toast.success("Log saved.");
    },
    onError,
  });

  const saveMed = useMutation({
    mutationFn: async () => {
      const input = { ...medForm, schedule_times: medTimes.length ? medTimes : null };
      return editingMed ? updateMedication(editingMed.id, input) : createMedication(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthKeys.medications });
      setMedDialog(false);
      toast.success(editingMed ? "Medication updated." : "Medication added.");
    },
    onError,
  });

  const removeMed = useMutation({
    mutationFn: (id: string) => deleteMedication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthKeys.medications });
      queryClient.invalidateQueries({ queryKey: healthKeys.medicationLogs });
      setToDelete(null);
      toast.success("Medication removed.");
    },
    onError,
  });

  const toggleDose = useMutation({
    mutationFn: (input: { medication_id: string; time_slot: string; taken: boolean }) =>
      setDoseTaken({ ...input, log_date: date }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: healthKeys.medicationLogs }),
    onError,
  });

  function openMedCreate() {
    setEditingMed(null);
    setMedForm(emptyMedication);
    setMedTimes([]);
    setNewTime("");
    setMedDialog(true);
  }

  function openMedEdit(medication: Medication) {
    setEditingMed(medication);
    setMedForm({
      name: medication.name,
      dosage: medication.dosage,
      schedule_times: medication.schedule_times,
      notes: medication.notes,
      active: medication.active,
    });
    setMedTimes(medication.schedule_times ?? []);
    setNewTime("");
    setMedDialog(true);
  }

  function addTime() {
    const value = newTime.trim();
    if (!value || medTimes.includes(value)) return;
    setMedTimes([...medTimes, value].sort());
    setNewTime("");
  }

  function toggleCategory(category: string) {
    const current = logForm.food_categories ?? [];
    const next = current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category];
    setLogForm({ ...logForm, food_categories: next.length ? next : null });
  }

  const loading = body.isLoading || logs.isLoading || medications.isLoading || doses.isLoading;
  const error = body.error ?? logs.error ?? medications.error ?? doses.error;

  if (loading) {
    return (
      <>
        <PageHeader title="Health" description="Log your day in a few taps." />
        <LoadingState rows={4} />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Health" description="Log your day in a few taps." />
        <ErrorState
          error={error}
          onRetry={() => {
            body.refetch();
            logs.refetch();
            medications.refetch();
            doses.refetch();
          }}
        />
      </>
    );
  }

  const heightCm = body.data?.height_cm == null ? null : Number(body.data.height_cm);
  const savedWeight = body.data?.weight_kg == null ? null : Number(body.data.weight_kg);
  const savedWeightDate = savedWeight == null ? null : (body.data?.updated_at ?? null);
  const bmiValue = bmi(heightCm, savedWeight);
  const recent = (logs.data ?? []).filter((log) => log.log_date !== date).slice(0, 7);
  const dayDoses = (doses.data ?? []).filter((dose) => dose.log_date === date);
  const activeMeds = (medications.data ?? []).filter((medication) => medication.active);
  const medRing = dosesOn(medications.data ?? [], doses.data ?? [], date);
  const sleepHours = withSampleDays(
    healthSeries(logs.data ?? [], "sleep_hours", sleepDays),
    samples.data ?? [],
    "sleep",
    sleepDays,
    (minutes) => Math.round((minutes / 60) * 10) / 10,
  );
  const sleepScores = withSampleDays(
    healthSeries(logs.data ?? [], "sleep_score", sleepDays),
    samples.data ?? [],
    "sleep_score",
    sleepDays,
    Math.round,
  );
  const hoursText = (value: number) => `${Math.round(value * 10) / 10} h`;

  return (
    <>
      <PageHeader title="Health" description="Tracking only. Your setup lives in Settings." />

      <div className="space-y-5">
        <DateNav value={date} onChange={setDate} />
        <AreaHabits category="health" title="Health habits" date={date} />

        <GlanceSection>
          {medRing ? (
            <RingStat
              title={date === todayISO() ? "Medication today" : `Medication on ${fmtDate(date)}`}
              icon={Pill}
              done={medRing.done}
              total={medRing.total}
              center={`${medRing.done}/${medRing.total}`}
              headline={`${medRing.done} of ${medRing.total}`}
              detail={
                medRing.total === 1 ? "scheduled dose marked taken" : "scheduled doses marked taken"
              }
              tone={3}
              ringLabel={`${medRing.done} of ${medRing.total} scheduled doses taken`}
            >
              <div className="flex flex-wrap gap-2">
                {(medications.data ?? [])
                  .filter((medication) => medication.active)
                  .flatMap((medication) =>
                    [...new Set(medication.schedule_times ?? [])].map((slot) => ({
                      medication,
                      slot,
                    })),
                  )
                  .map(({ medication, slot }) => {
                    const taken = dayDoses.some(
                      (dose) =>
                        dose.medication_id === medication.id &&
                        dose.time_slot === slot &&
                        dose.taken,
                    );
                    return (
                      <button
                        key={`${medication.id}-${slot}`}
                        type="button"
                        aria-pressed={taken}
                        onClick={() =>
                          toggleDose.mutate({
                            medication_id: medication.id,
                            time_slot: slot,
                            taken: !taken,
                          })
                        }
                        className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs transition-transform active:scale-[0.97] ${
                          taken ? "tone-positive" : "border-border hover:bg-accent/50"
                        }`}
                      >
                        {taken ? <Check className="size-3.5" aria-hidden="true" /> : null}
                        <span className="font-medium">{medication.name}</span>
                        <span className="tabular-nums text-muted-foreground">{fmtSlot(slot)}</span>
                        {!taken ? (
                          <span className="text-muted-foreground">· Mark taken</span>
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            </RingStat>
          ) : (
            <StatCard title="Medication today" icon={Pill}>
              <p className="text-sm text-muted-foreground">
                No doses are scheduled. Add times to a medication below to see this.
              </p>
            </StatCard>
          )}

          <LatestValueCard
            title="Weight"
            icon={Scale}
            tone={4}
            value={savedWeight == null ? "—" : fmtWeight(savedWeight)}
            detail={
              savedWeight == null
                ? "No weight saved yet."
                : `Saved ${fmtDate(savedWeightDate)}. Only the latest weight is stored, so there is no trend to draw.`
            }
          />

          <div className="flex items-center justify-between gap-3 md:col-span-2">
            <p className="text-sm font-medium">Sleep</p>
            <RangeToggle
              label="Sleep range"
              value={sleepDays}
              onChange={setSleepDays}
              options={[
                { value: 14, label: "14 days" },
                { value: 30, label: "30 days" },
              ]}
            />
          </div>

          {hasEnoughPoints(sleepHours) ? (
            <TrendLine
              title="Sleep hours"
              icon={BedDouble}
              badge={`${sleepDays} days`}
              points={sleepHours}
              tone={1}
              seriesLabel="Sleep hours"
              formatValue={hoursText}
              formatDate={fmtDate}
              formatAxisDate={fmtShortDate}
              summary={`${sleepHours.length} entries in ${sleepDays} days`}
            />
          ) : (
            <StatCard title="Sleep hours" icon={BedDouble}>
              <NotEnoughData hint="Log sleep hours on at least two days." />
            </StatCard>
          )}

          {hasEnoughPoints(sleepScores) ? (
            <TrendLine
              title="Sleep score"
              icon={Sparkles}
              badge={`${sleepDays} days`}
              points={sleepScores}
              tone={5}
              seriesLabel="Sleep score"
              formatValue={(value) => String(Math.round(value))}
              formatDate={fmtDate}
              formatAxisDate={fmtShortDate}
              summary={`${sleepScores.length} entries in ${sleepDays} days`}
            />
          ) : (
            <StatCard title="Sleep score" icon={Sparkles}>
              <NotEnoughData hint="Enter a sleep score on at least two days." />
            </StatCard>
          )}
        </GlanceSection>

        <SamsungHealthCard />

        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Weight</CardTitle>
            <CardDescription>
              {heightCm != null
                ? `Height ${fmtHeight(heightCm)}, set in Settings.`
                : "Add your height in Settings to see your BMI here."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                saveWeight.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="weight">Current weight ({weightUnit})</Label>
                <Input
                  id="weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  className="h-12 w-40 text-base"
                  value={weightInput ?? ""}
                  onChange={(event) => setWeightInput(num(event.target.value))}
                />
              </div>
              <Button type="submit" className="h-12" disabled={saveWeight.isPending}>
                {saveWeight.isPending ? "Saving…" : "Save weight"}
              </Button>
              {!heightCm ? null : (
                <Button asChild variant="ghost" className="h-12">
                  <Link to="/settings">Body setup</Link>
                </Button>
              )}
            </form>
            <div className="mt-4 rounded-xl border border-border px-4 py-3">
              {bmiValue != null ? (
                <>
                  <p className="text-sm font-medium tabular-nums text-foreground">
                    BMI {bmiValue.toFixed(1)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Weight in kg ÷ height in m², from {fmtHeight(heightCm ?? 0)} and the weight
                    saved{savedWeightDate ? ` on ${fmtDate(savedWeightDate)}` : ""}.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {heightCm == null
                    ? "Add your height in Settings and save a weight to see your BMI here."
                    : "Save a weight to see your BMI here."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card id="meals" className="system-card scroll-mt-20">
          <CardHeader>
            <CardTitle className="text-base">Meals</CardTitle>
            <CardDescription>
              Tap what you had. The meal is picked from the time of day; type anything else.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuickMeals date={date} showLink />
          </CardContent>
        </Card>

        <Card id="daily-log" className="system-card scroll-mt-20">
          <CardHeader>
            <CardTitle className="text-base">
              Log for {date === todayISO() ? "today" : fmtLongDate(new Date(`${date}T12:00:00`))}
            </CardTitle>
            <CardDescription>A few taps. Anything you skip stays empty.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-6"
              onSubmit={(event) => {
                event.preventDefault();
                saveLog.mutate();
              }}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex min-h-14 items-center justify-between rounded-xl border border-border px-4 py-3">
                  <Label htmlFor="trained">Trained</Label>
                  <Switch
                    id="trained"
                    checked={logForm.trained === true}
                    onCheckedChange={(value) => setLogForm({ ...logForm, trained: value })}
                  />
                </div>
                <div className="flex min-h-14 items-center justify-between rounded-xl border border-border px-4 py-3">
                  <Label htmlFor="water">Water target met</Label>
                  <Switch
                    id="water"
                    checked={logForm.water_ok === true}
                    onCheckedChange={(value) => setLogForm({ ...logForm, water_ok: value })}
                  />
                </div>
                <NumberField
                  id="sleep-score"
                  label="Sleep score"
                  value={logForm.sleep_score}
                  onChange={(value) => setLogForm({ ...logForm, sleep_score: value })}
                  suffix="of 100"
                />
                <DurationField
                  id="sleep-actual"
                  label="Sleep time"
                  value={logForm.actual_sleep_minutes}
                  onChange={(value) => setLogForm({ ...logForm, actual_sleep_minutes: value })}
                />
                <ScaleRow
                  label="Stress"
                  kind="stress"
                  value={logForm.stress_level}
                  onChange={(value) => setLogForm({ ...logForm, stress_level: value })}
                />
                <ScaleRow
                  label="Mood"
                  kind="mood"
                  value={logForm.mood}
                  onChange={(value) => setLogForm({ ...logForm, mood: value })}
                />
                <ScaleRow
                  label="Food quality"
                  kind="food"
                  value={logForm.food_quality}
                  onChange={(value) => setLogForm({ ...logForm, food_quality: value })}
                />
              </div>

              <Collapsible open={sleepDetail} onOpenChange={setSleepDetail}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" className="h-11">
                    {sleepDetail ? "Hide detail" : "More detail"}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 grid gap-5 sm:grid-cols-2">
                  <DurationField
                    id="time-in-bed"
                    label="Time in bed"
                    value={logForm.time_in_bed_minutes}
                    onChange={(value) => setLogForm({ ...logForm, time_in_bed_minutes: value })}
                  />
                  <DurationField
                    id="deep-sleep"
                    label="Deep sleep"
                    value={logForm.deep_sleep_minutes}
                    onChange={(value) => setLogForm({ ...logForm, deep_sleep_minutes: value })}
                  />
                  <DurationField
                    id="rem-sleep"
                    label="REM sleep"
                    value={logForm.rem_sleep_minutes}
                    onChange={(value) => setLogForm({ ...logForm, rem_sleep_minutes: value })}
                  />
                  <DurationField
                    id="light-sleep"
                    label="Light sleep"
                    value={logForm.light_sleep_minutes}
                    onChange={(value) => setLogForm({ ...logForm, light_sleep_minutes: value })}
                  />
                  <DurationField
                    id="awake"
                    label="Awake"
                    value={logForm.awake_minutes}
                    onChange={(value) => setLogForm({ ...logForm, awake_minutes: value })}
                  />
                  <DurationField
                    id="sleep-latency"
                    label="Time to fall asleep"
                    value={logForm.sleep_latency_minutes}
                    onChange={(value) => setLogForm({ ...logForm, sleep_latency_minutes: value })}
                  />
                  <NumberField
                    id="blood-oxygen"
                    label="Blood oxygen average"
                    value={logForm.blood_oxygen_avg}
                    onChange={(value) => setLogForm({ ...logForm, blood_oxygen_avg: value })}
                    suffix="%"
                    step="0.1"
                  />
                  <NumberField
                    id="heart-rate"
                    label="Heart rate average"
                    value={logForm.heart_rate_avg}
                    onChange={(value) => setLogForm({ ...logForm, heart_rate_avg: value })}
                    suffix="bpm"
                    step="0.1"
                  />
                  <NumberField
                    id="respiratory-rate"
                    label="Respiratory rate average"
                    value={logForm.respiratory_rate_avg}
                    onChange={(value) => setLogForm({ ...logForm, respiratory_rate_avg: value })}
                    suffix="per min"
                    step="0.1"
                  />
                  <div className="space-y-2">
                    <Label htmlFor="sleep-start">Sleep started</Label>
                    <Input
                      id="sleep-start"
                      type="time"
                      className="h-12 text-base"
                      value={timeOf(logForm.sleep_start_at)}
                      onChange={(event) =>
                        setLogForm({
                          ...logForm,
                          sleep_start_at: timeToISO(date, event.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sleep-end">Sleep ended</Label>
                    <Input
                      id="sleep-end"
                      type="time"
                      className="h-12 text-base"
                      value={timeOf(logForm.sleep_end_at)}
                      onChange={(event) =>
                        setLogForm({
                          ...logForm,
                          sleep_end_at: timeToISO(date, event.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="sleep-source">Measured with</Label>
                    <Input
                      id="sleep-source"
                      placeholder="Device name, if you want to record it"
                      className="h-12 text-base"
                      value={logForm.sleep_source ?? ""}
                      onChange={(event) =>
                        setLogForm({ ...logForm, sleep_source: event.target.value || null })
                      }
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-2">
                <Label htmlFor="log-note">Note</Label>
                <Textarea
                  id="log-note"
                  value={logForm.note ?? ""}
                  onChange={(event) => setLogForm({ ...logForm, note: event.target.value || null })}
                />
              </div>

              <Button type="submit" className="h-12" disabled={saveLog.isPending}>
                {saveLog.isPending ? "Saving…" : "Save log"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Recent days</CardTitle>
            <CardDescription>Your last entries, most recent first.</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState
                title="No other entries yet"
                description="A daily log keeps a record of how you felt and slept, in your own words and numbers."
              />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((log) => (
                  <li
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <button
                      type="button"
                      className="font-medium text-foreground hover:underline"
                      onClick={() => setDate(log.log_date)}
                    >
                      {fmtDate(log.log_date)}
                    </button>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {log.trained ? <SemanticBadge tone="positive">Trained</SemanticBadge> : null}
                      {log.actual_sleep_minutes != null || log.sleep_hours != null ? (
                        <span className="tabular-nums">
                          {formatDuration(
                            log.actual_sleep_minutes ?? Math.round(Number(log.sleep_hours) * 60),
                          )}{" "}
                          sleep
                        </span>
                      ) : null}
                      {log.sleep_score != null ? (
                        <span className="tabular-nums">Sleep score {log.sleep_score}</span>
                      ) : null}
                      {log.mood != null ? (
                        <SemanticBadge tone={scaleTone("mood", log.mood)}>
                          Mood {log.mood} of 5
                        </SemanticBadge>
                      ) : null}
                      {log.stress_level != null ? (
                        <SemanticBadge
                          tone={scaleTone("stress", log.stress_level)}
                          className="hidden sm:inline-flex"
                        >
                          Stress {log.stress_level} of 5
                        </SemanticBadge>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card id="medications" className="system-card scroll-mt-20">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Medications</CardTitle>
                <CardDescription>
                  This is an in-app schedule and checklist only. Reliable background reminders will
                  need the future mobile app, so it will not alarm your phone.
                </CardDescription>
              </div>
              <Button type="button" onClick={openMedCreate}>
                Add medication
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(medications.data ?? []).length === 0 ? (
              <EmptyState
                title="No medications yet"
                description="Add the medication schedule you already follow, and today's doses appear on Today for one-tap logging."
                action={
                  <Button type="button" onClick={openMedCreate}>
                    Add medication
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-3">
                {(medications.data ?? []).map((medication) => (
                  <li key={medication.id} className="rounded-xl border border-border px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {medication.name}
                          {!medication.active ? (
                            <span className="ml-2 text-xs text-muted-foreground">Inactive</span>
                          ) : null}
                        </p>
                        {medication.dosage ? (
                          <p className="text-sm text-muted-foreground">{medication.dosage}</p>
                        ) : null}
                        {medication.notes ? (
                          <p className="mt-1 hidden max-w-xl text-xs text-muted-foreground sm:block">
                            {medication.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => openMedEdit(medication)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setToDelete(medication)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    {medication.active && (medication.schedule_times ?? []).length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(medication.schedule_times ?? []).map((slot) => {
                          const taken = dayDoses.some(
                            (dose) =>
                              dose.medication_id === medication.id &&
                              dose.time_slot === slot &&
                              dose.taken,
                          );
                          return (
                            <button
                              key={slot}
                              type="button"
                              aria-pressed={taken}
                              className={`min-h-11 rounded-full border px-4 text-sm tabular-nums transition-colors ${
                                taken
                                  ? "tone-positive"
                                  : "border-border text-muted-foreground hover:bg-accent/50"
                              }`}
                              onClick={() =>
                                toggleDose.mutate({
                                  medication_id: medication.id,
                                  time_slot: slot,
                                  taken: !taken,
                                })
                              }
                            >
                              {fmtSlot(slot)}
                              {taken ? " · taken" : ""}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {activeMeds.length > 0 &&
            activeMeds.every((medication) => (medication.schedule_times ?? []).length === 0) ? (
              <p className="text-xs text-muted-foreground">
                Add times to a medication to get a daily taken checklist.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <FormDialog
        open={medDialog}
        onOpenChange={setMedDialog}
        title={editingMed ? "Edit medication" : "Add medication"}
        description="Stored exactly as you enter it. No dosing guidance is given."
        pending={saveMed.isPending}
        onSubmit={() => saveMed.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="med-name">Name</Label>
          <Input
            id="med-name"
            required
            value={medForm.name}
            onChange={(event) => setMedForm({ ...medForm, name: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="med-dosage">Dosage (optional)</Label>
          <Input
            id="med-dosage"
            value={medForm.dosage ?? ""}
            onChange={(event) => setMedForm({ ...medForm, dosage: event.target.value || null })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="med-time">Schedule times (optional)</Label>
          <div className="flex gap-2">
            <Input
              id="med-time"
              type="time"
              className="h-12"
              value={newTime}
              onChange={(event) => setNewTime(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTime();
                }
              }}
            />
            <Button type="button" variant="outline" className="h-12" onClick={addTime}>
              <Plus className="size-4" aria-hidden="true" />
              Add time
            </Button>
          </div>
          {medTimes.length > 0 ? (
            <ul className="flex flex-wrap gap-2 pt-1">
              {medTimes.map((slot) => (
                <li key={slot}>
                  <button
                    type="button"
                    className="flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm tabular-nums"
                    aria-label={`Remove ${slot}`}
                    onClick={() => setMedTimes(medTimes.filter((item) => item !== slot))}
                  >
                    {fmtSlot(slot)}
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="med-notes">Notes (optional)</Label>
          <Textarea
            id="med-notes"
            value={medForm.notes ?? ""}
            onChange={(event) => setMedForm({ ...medForm, notes: event.target.value || null })}
          />
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="med-active"
            checked={medForm.active}
            onCheckedChange={(value) => setMedForm({ ...medForm, active: value })}
          />
          <Label htmlFor="med-active">Active</Label>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Remove this medication?"
        description={
          toDelete && (toDelete.schedule_times ?? []).length > 0
            ? "Its scheduled times and daily taken records will be removed too."
            : "Its daily records will be removed too."
        }
        onConfirm={() => toDelete && removeMed.mutate(toDelete.id)}
      />
    </>
  );
}
