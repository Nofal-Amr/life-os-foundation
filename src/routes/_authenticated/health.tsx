import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DateNav } from "@/components/app/DateNav";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { SemanticBadge } from "@/components/app/SemanticBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { bmiContext, weightToDisplay, weightToStored } from "@/lib/format";
import { scaleTone } from "@/lib/semantics";

export const Route = createFileRoute("/_authenticated/health")({
  head: () => ({
    meta: [
      { title: "Health — Life OS" },
      {
        name: "description",
        content: "A fast daily health log, your weight, and your own medication schedule.",
      },
      { property: "og:title", content: "Health — Life OS" },
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
  };
}

function num(value: string): number | null {
  const parsed = Number(value);
  return value.trim() === "" || Number.isNaN(parsed) ? null : parsed;
}

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
    </div>
  );
}

function HealthPage() {
  const queryClient = useQueryClient();
  const body = useQuery(bodyStatsQuery());
  const logs = useQuery(healthLogsQuery());
  const medications = useQuery(medicationsQuery());
  const doses = useQuery(medicationLogsQuery());
  const { prefs, fmtDate, fmtLongDate, fmtSlot, fmtHeight, weightUnit } = usePreferences();

  const [date, setDate] = useState(todayISO());
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
  const storedWeight = weightToStored(weightInput, prefs);
  const bmiValue = bmi(heightCm, storedWeight);
  const recent = (logs.data ?? []).filter((log) => log.log_date !== date).slice(0, 7);
  const dayDoses = (doses.data ?? []).filter((dose) => dose.log_date === date);
  const activeMeds = (medications.data ?? []).filter((medication) => medication.active);

  return (
    <>
      <PageHeader title="Health" description="Tracking only. Your setup lives in Settings." />

      <div className="space-y-5">
        <DateNav value={date} onChange={setDate} />

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
            {bmiValue != null ? (
              <div className="mt-4 rounded-xl border border-border px-4 py-3">
                <p className="text-sm font-medium tabular-nums text-foreground">
                  BMI {bmiValue.toFixed(1)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{bmiContext(bmiValue)}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="system-card">
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
                <div className="space-y-2">
                  <Label htmlFor="sleep">Sleep (hours)</Label>
                  <Input
                    id="sleep"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    max="24"
                    className="h-12 text-base"
                    value={logForm.sleep_hours ?? ""}
                    onChange={(event) =>
                      setLogForm({ ...logForm, sleep_hours: num(event.target.value) })
                    }
                  />
                </div>
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

              <div className="space-y-2">
                <Label>Food categories</Label>
                <div className="flex flex-wrap gap-2">
                  {FOOD_CATEGORIES.map((category) => {
                    const selected = (logForm.food_categories ?? []).includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        aria-pressed={selected}
                        className={`min-h-11 rounded-full border px-4 text-sm capitalize transition-colors ${
                          selected
                            ? "tone-info"
                            : "border-border text-muted-foreground hover:bg-accent/50"
                        }`}
                        onClick={() => toggleCategory(category)}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>

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
                description="Log a day to begin building a record."
              />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((log) => (
                  <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <button
                      type="button"
                      className="font-medium text-foreground hover:underline"
                      onClick={() => setDate(log.log_date)}
                    >
                      {fmtDate(log.log_date)}
                    </button>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {log.trained ? <SemanticBadge tone="positive">Trained</SemanticBadge> : null}
                      {log.sleep_hours != null ? (
                        <span className="tabular-nums">{Number(log.sleep_hours)}h sleep</span>
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

        <Card className="system-card">
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
                description="Add the schedule you already follow to keep track of it here."
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
