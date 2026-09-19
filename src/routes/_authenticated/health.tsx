import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Badge } from "@/components/ui/badge";
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
  type BodyStatsInput,
  type HealthLogInput,
  type Medication,
  type MedicationInput,
} from "@/data/health";
import { formatDate, todayISO } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/health")({
  head: () => ({
    meta: [
      { title: "Health — Life OS" },
      {
        name: "description",
        content: "Body stats, a fast daily log, and your own medication schedule.",
      },
      { property: "og:title", content: "Health — Life OS" },
      {
        property: "og:description",
        content: "Body stats, a fast daily log, and your own medication schedule.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HealthPage,
});

const emptyBody: BodyStatsInput = {
  height_cm: null,
  weight_kg: null,
  birthdate: null,
  target_weight_kg: null,
  notes: null,
};

const emptyMedication: MedicationInput = {
  name: "",
  dosage: null,
  schedule_times: null,
  notes: null,
  active: true,
};

function num(value: string): number | null {
  const parsed = Number(value);
  return value.trim() === "" || Number.isNaN(parsed) ? null : parsed;
}

function ScaleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((level) => (
          <Button
            key={level}
            type="button"
            size="sm"
            variant={value === level ? "default" : "outline"}
            aria-pressed={value === level}
            aria-label={`${label} ${level} of 5`}
            className="w-10 tabular-nums"
            onClick={() => onChange(value === level ? null : level)}
          >
            {level}
          </Button>
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
  const today = todayISO();

  const [bodyForm, setBodyForm] = useState<BodyStatsInput>(emptyBody);
  const [logForm, setLogForm] = useState<HealthLogInput>({
    log_date: today,
    trained: null,
    sleep_hours: null,
    stress_level: null,
    water_ok: null,
    food_quality: null,
    food_categories: null,
    mood: null,
    note: null,
  });
  const [medDialog, setMedDialog] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [medForm, setMedForm] = useState<MedicationInput>(emptyMedication);
  const [medTimes, setMedTimes] = useState("");
  const [toDelete, setToDelete] = useState<Medication | null>(null);

  useEffect(() => {
    if (body.data) {
      setBodyForm({
        height_cm: body.data.height_cm == null ? null : Number(body.data.height_cm),
        weight_kg: body.data.weight_kg == null ? null : Number(body.data.weight_kg),
        birthdate: body.data.birthdate,
        target_weight_kg:
          body.data.target_weight_kg == null ? null : Number(body.data.target_weight_kg),
        notes: body.data.notes,
      });
    }
  }, [body.data]);

  useEffect(() => {
    const entry = (logs.data ?? []).find((log) => log.log_date === today);
    if (entry) {
      setLogForm({
        log_date: entry.log_date,
        trained: entry.trained,
        sleep_hours: entry.sleep_hours == null ? null : Number(entry.sleep_hours),
        stress_level: entry.stress_level,
        water_ok: entry.water_ok,
        food_quality: entry.food_quality,
        food_categories: entry.food_categories,
        mood: entry.mood,
        note: entry.note,
      });
    }
  }, [logs.data, today]);

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const saveBody = useMutation({
    mutationFn: () => saveBodyStats(bodyForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthKeys.body });
      toast.success("Body stats saved.");
    },
    onError,
  });

  const saveLog = useMutation({
    mutationFn: () => saveHealthLog(logForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthKeys.logs });
      toast.success("Today's log saved.");
    },
    onError,
  });

  const saveMed = useMutation({
    mutationFn: async () => {
      const schedule_times = medTimes
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      const input = { ...medForm, schedule_times: schedule_times.length ? schedule_times : null };
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
      setDoseTaken({ ...input, log_date: today }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: healthKeys.medicationLogs }),
    onError,
  });

  function openMedCreate() {
    setEditingMed(null);
    setMedForm(emptyMedication);
    setMedTimes("");
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
    setMedTimes((medication.schedule_times ?? []).join(", "));
    setMedDialog(true);
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
        <PageHeader title="Health" description="Your body, your day, your schedule." />
        <LoadingState rows={4} />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Health" description="Your body, your day, your schedule." />
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

  const bmiValue = bmi(bodyForm.height_cm, bodyForm.weight_kg);
  const recent = (logs.data ?? []).filter((log) => log.log_date !== today).slice(0, 7);
  const todayDoses = doses.data ?? [];
  const activeMeds = (medications.data ?? []).filter((medication) => medication.active);

  return (
    <>
      <PageHeader
        title="Health"
        description="Body stats, a fast daily log, and the medication schedule you set."
      />

      <div className="space-y-6">
        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Body stats</CardTitle>
            <CardDescription>
              {bmiValue != null
                ? `BMI ${bmiValue.toFixed(1)} from your current height and weight.`
                : "Add height and weight to see your BMI."}
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={bodyForm.height_cm ?? ""}
                    onChange={(event) =>
                      setBodyForm({ ...bodyForm, height_cm: num(event.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={bodyForm.weight_kg ?? ""}
                    onChange={(event) =>
                      setBodyForm({ ...bodyForm, weight_kg: num(event.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-weight">Target weight (kg)</Label>
                  <Input
                    id="target-weight"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={bodyForm.target_weight_kg ?? ""}
                    onChange={(event) =>
                      setBodyForm({ ...bodyForm, target_weight_kg: num(event.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthdate">Birthdate</Label>
                  <Input
                    id="birthdate"
                    type="date"
                    value={bodyForm.birthdate ?? ""}
                    onChange={(event) =>
                      setBodyForm({ ...bodyForm, birthdate: event.target.value || null })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="body-notes">Notes</Label>
                <Textarea
                  id="body-notes"
                  value={bodyForm.notes ?? ""}
                  onChange={(event) =>
                    setBodyForm({ ...bodyForm, notes: event.target.value || null })
                  }
                />
              </div>
              <Button type="submit" disabled={saveBody.isPending}>
                {saveBody.isPending ? "Saving…" : "Save body stats"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Today's log</CardTitle>
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
                <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                  <Label htmlFor="trained">Trained today</Label>
                  <Switch
                    id="trained"
                    checked={logForm.trained === true}
                    onCheckedChange={(value) => setLogForm({ ...logForm, trained: value })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
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
                    value={logForm.sleep_hours ?? ""}
                    onChange={(event) =>
                      setLogForm({ ...logForm, sleep_hours: num(event.target.value) })
                    }
                  />
                </div>
                <ScaleRow
                  label="Stress"
                  value={logForm.stress_level}
                  onChange={(value) => setLogForm({ ...logForm, stress_level: value })}
                />
                <ScaleRow
                  label="Mood"
                  value={logForm.mood}
                  onChange={(value) => setLogForm({ ...logForm, mood: value })}
                />
                <ScaleRow
                  label="Food quality"
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
                      <Button
                        key={category}
                        type="button"
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        aria-pressed={selected}
                        className="rounded-full capitalize"
                        onClick={() => toggleCategory(category)}
                      >
                        {category}
                      </Button>
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

              <Button type="submit" disabled={saveLog.isPending}>
                {saveLog.isPending ? "Saving…" : "Save today's log"}
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
                title="No earlier entries yet"
                description="Log your first day to begin building a record."
              />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((log) => (
                  <li
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <span className="font-medium">{formatDate(log.log_date)}</span>
                    <span className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {log.trained ? <Badge variant="secondary">Trained</Badge> : null}
                      {log.sleep_hours != null ? (
                        <span className="tabular-nums">{Number(log.sleep_hours)}h sleep</span>
                      ) : null}
                      <span className="hidden sm:inline">
                        {log.mood != null ? `Mood ${log.mood}/5` : null}
                      </span>
                      <span className="hidden sm:inline">
                        {log.stress_level != null ? `Stress ${log.stress_level}/5` : null}
                      </span>
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
                          const taken = todayDoses.some(
                            (dose) =>
                              dose.medication_id === medication.id &&
                              dose.log_date === today &&
                              dose.time_slot === slot &&
                              dose.taken,
                          );
                          return (
                            <Button
                              key={slot}
                              type="button"
                              size="sm"
                              variant={taken ? "default" : "outline"}
                              aria-pressed={taken}
                              className="rounded-full tabular-nums"
                              onClick={() =>
                                toggleDose.mutate({
                                  medication_id: medication.id,
                                  time_slot: slot,
                                  taken: !taken,
                                })
                              }
                            >
                              {slot} {taken ? "· taken" : ""}
                            </Button>
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
          <Label htmlFor="med-dosage">Dosage</Label>
          <Input
            id="med-dosage"
            value={medForm.dosage ?? ""}
            onChange={(event) => setMedForm({ ...medForm, dosage: event.target.value || null })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="med-times">Schedule times</Label>
          <Input
            id="med-times"
            placeholder="08:00, 20:00"
            value={medTimes}
            onChange={(event) => setMedTimes(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">Separate times with commas.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="med-notes">Notes</Label>
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
        description="Its daily records will be removed too."
        onConfirm={() => toDelete && removeMed.mutate(toDelete.id)}
      />
    </>
  );
}
