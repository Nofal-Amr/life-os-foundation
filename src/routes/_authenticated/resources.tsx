import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Wallet, Wifi, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DatePicker } from "@/components/app/DatePicker";
import { ResourceUsage } from "@/components/app/ResourceUsage";
import { EntityIcon, EntityIdentityPicker, entityIconOf } from "@/components/app/EntityIdentity";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import {
  GlanceSection,
  NotEnoughData,
  RingStat,
  StatCard,
  TrendLine,
} from "@/components/app/StatCards";
import { SemanticBadge } from "@/components/app/SemanticBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
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
import {
  accountsQuery,
  createTransaction,
  financeCategoriesQuery,
  financeKeys,
} from "@/data/finance";
import {
  RESOURCE_KINDS,
  addReading,
  createResource,
  deleteResource,
  meterFacts,
  tierUsage,
  quotaFacts,
  readingsFor,
  resourceKeys,
  resourceReadingsQuery,
  resourcesQuery,
  updateResource,
  type Resource,
  type ResourceInput,
  type ResourceKind,
} from "@/data/resources";
import { hasEnoughPoints, meterCostPerDay, quotaRing } from "@/data/stats";
import { usePreferences } from "@/hooks/usePreferences";

import {
  EGYPT_RESIDENTIAL_2026,
  parseTariff,
  tierFor,
  tierRangeLabel,
  untilNextTier,
  type Tariff,
} from "@/data/tariff";
import { isoToLocalInput, localInputToISO, todayISO } from "@/lib/date";

const STARTER_RESOURCES: { name: string; kind: ResourceKind; unit: string }[] = [
  { name: "Electricity", kind: "meter", unit: "kWh" },
  { name: "Water", kind: "meter", unit: "m3" },
  { name: "Internet", kind: "quota", unit: "GB" },
];

export const Route = createFileRoute("/_authenticated/resources")({
  head: () => ({
    meta: [
      { title: "Resources · Life OS" },
      {
        name: "description",
        content: "Meter readings and quotas, with usage and cost worked out from what you log.",
      },
      { property: "og:title", content: "Resources · Life OS" },
      {
        property: "og:description",
        content: "Meter readings and quotas, with usage and cost worked out from what you log.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResourcesPage,
});

const emptyResource: ResourceInput = {
  name: "",
  kind: "meter",
  unit: "",
  unit_cost: null,
  category_id: null,
  account_id: null,
  quota_amount: null,
  cycle_start_date: null,
  cycle_days: null,
  /* Most bills run in calendar months, so that is the starting point. */
  cycle_unit: "months",
  cycle_count: 1,
  icon: null,
  color: null,
  active: true,
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function ResourcesPage() {
  const queryClient = useQueryClient();
  const resources = useQuery(resourcesQuery());
  const readings = useQuery(resourceReadingsQuery());
  const categories = useQuery(financeCategoriesQuery());
  const accounts = useQuery(accountsQuery());
  const { fmtDate, fmtMoney, fmtShortDate } = usePreferences();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [form, setForm] = useState<ResourceInput>(emptyResource);
  const [toDelete, setToDelete] = useState<Resource | null>(null);
  const [readingFor, setReadingFor] = useState<Resource | null>(null);
  const [readingValue, setReadingValue] = useState("");
  /** When the reading was taken ("yyyy-MM-ddTHH:mm", local); defaults to now. */
  const [readingAt, setReadingAt] = useState("");

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: () => (editing ? updateResource(editing.id, form) : createResource(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.all });
      setDialogOpen(false);
      toast.success(editing ? "Resource updated." : "Resource added.");
    },
    onError,
  });

  /* Empty starting points only — no readings, no costs, no quota figures. */
  const addStarter = useMutation({
    mutationFn: (starter: { name: string; kind: ResourceKind; unit: string }) =>
      createResource({
        name: starter.name,
        kind: starter.kind,
        unit: starter.unit,
        unit_cost: null,
        category_id: null,
        account_id: null,
        quota_amount: null,
        cycle_start_date: null,
        cycle_days: null,
        cycle_unit: "months",
        cycle_count: 1,
        icon: null,
        color: null,
        active: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.all });
      toast.success("Added. Fill in its readings and cost when you have them.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteResource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.all });
      queryClient.invalidateQueries({ queryKey: resourceKeys.readings });
      setToDelete(null);
      toast.success("Resource removed.");
    },
    onError,
  });

  const logReading = useMutation({
    mutationFn: () => {
      if (!readingFor) throw new Error("Choose a resource.");
      const value = Number(readingValue);
      if (readingValue === "" || Number.isNaN(value)) throw new Error("Enter the reading.");
      return addReading({
        resource_id: readingFor.id,
        reading: value,
        reading_at: readingAt ? localInputToISO(readingAt) : new Date().toISOString(),
        note: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.readings });
      setReadingFor(null);
      setReadingValue("");
      toast.success("Reading added.");
    },
    onError,
  });

  const logCost = useMutation({
    mutationFn: async (args: { resource: Resource; amount: number; label: string }) => {
      const accountId =
        args.resource.account_id ?? (accounts.data ?? []).find((a) => a.active)?.id ?? null;
      if (!accountId) throw new Error("Add an account on the Money page first.");
      return createTransaction({
        account_id: accountId,
        category_id: args.resource.category_id,
        amount: -Math.abs(args.amount),
        kind: "expense",
        description: args.label,
        date: todayISO(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.transactions });
      toast.success("Cost logged as a transaction.");
    },
    onError,
  });

  const loading = resources.isLoading || readings.isLoading;
  const error = resources.error ?? readings.error;

  function openCreate() {
    setEditing(null);
    setForm(emptyResource);
    setDialogOpen(true);
  }

  function openEdit(resource: Resource) {
    setEditing(resource);
    setForm({
      name: resource.name,
      kind: resource.kind,
      unit: resource.unit,
      unit_cost: resource.unit_cost == null ? null : Number(resource.unit_cost),
      category_id: resource.category_id,
      account_id: resource.account_id,
      quota_amount: resource.quota_amount == null ? null : Number(resource.quota_amount),
      cycle_start_date: resource.cycle_start_date,
      cycle_days: resource.cycle_days,
      cycle_unit: resource.cycle_unit === "days" ? "days" : "months",
      cycle_count: resource.cycle_count ?? 1,
      icon: resource.icon,
      color: resource.color,
      active: resource.active,
      tariff: parseTariff(resource.tariff),
    });
    setDialogOpen(true);
  }

  function openReading(resource: Resource) {
    setReadingFor(resource);
    setReadingValue("");
    setReadingAt(isoToLocalInput(new Date().toISOString()));
  }

  const list = resources.data ?? [];
  const plain = (value: number) => String(Math.round(value * 100) / 100);
  const glance = list
    .filter((resource) => resource.active)
    .map((resource) => {
      const usage = tierUsage(resource, readings.data ?? []);
      if (usage) {
        const tier = usage.bill.tier;
        const top = usage.tariff.tiers[tier - 1]!.max;
        return (
          <RingStat
            key={resource.id}
            title={`${resource.name} this month`}
            icon={entityIconOf(resource.icon)}
            done={usage.used}
            total={top ?? usage.used}
            center={`Tier ${tier}`}
            headline={`${plain(usage.used)} ${resource.unit}`}
            detail={
              usage.until
                ? `${Math.ceil(usage.until.kwh)} ${resource.unit} until tier ${usage.until.next} · about ${fmtMoney(usage.bill.total)} so far`
                : `Highest tier · about ${fmtMoney(usage.bill.total)} so far`
            }
            tone={4}
            ringLabel={`${plain(usage.used)} ${resource.unit} used this month, tier ${tier} of ${usage.tariff.tiers.length}`}
          >
            <Button size="sm" variant="outline" onClick={() => openReading(resource)}>
              <Plus className="size-4" />
              Add reading
            </Button>
          </RingStat>
        );
      }
      if (resource.kind === "quota") {
        const ring = quotaRing(resource, readings.data ?? []);
        const facts = quotaFacts(resource, readings.data ?? []);
        if (!ring && facts) {
          return (
            <StatCard key={resource.id} title={`${resource.name} left`} icon={entityIconOf(resource.icon)} tone={2}>
              <p className="figure">
                {plain(facts.remaining)} <span className="text-base font-medium text-muted-foreground">{resource.unit}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {facts.perDay != null && facts.daysLeft != null
                  ? facts.daysLeft < 1
                    ? `Less than a day left at ${plain(facts.perDay)} ${resource.unit} a day.`
                    : `About ${Math.floor(facts.daysLeft)} ${Math.floor(facts.daysLeft) === 1 ? "day" : "days"} left at ${plain(facts.perDay)} ${resource.unit} a day.`
                  : "Add readings on a few different days to see how long it lasts."}
                {" "}From your reading on {fmtDate(facts.latest.reading_at.slice(0, 10))}.
              </p>
              <Button size="sm" variant="outline" className="mt-4" onClick={() => openReading(resource)}>
                <Plus className="size-4" />
                Add reading
              </Button>
            </StatCard>
          );
        }
        if (!ring) {
          return (
            <StatCard key={resource.id} title={`${resource.name} left`} icon={entityIconOf(resource.icon)}>
              <p className="text-sm text-muted-foreground">
                Add a quota amount and a reading to see this.
              </p>
            </StatCard>
          );
        }
        return (
          <RingStat
            key={resource.id}
            title={`${resource.name} left`}
            icon={entityIconOf(resource.icon)}
            done={ring.remaining}
            total={ring.quota}
            center={plain(ring.remaining)}
            headline={`${plain(ring.remaining)} of ${plain(ring.quota)} ${ring.unit}`}
            detail={`From your reading on ${fmtDate(ring.readingAt.slice(0, 10))}.`}
            tone={2}
            ringLabel={`${plain(ring.remaining)} of ${plain(ring.quota)} ${ring.unit} left`}
          >
            <Button size="sm" variant="outline" onClick={() => openReading(resource)}>
              <Plus className="size-4" />
              Add reading
            </Button>
          </RingStat>
        );
      }
      if (resource.unit_cost == null) {
        return (
          <StatCard key={resource.id} title={`${resource.name} cost per day`} icon={entityIconOf(resource.icon)}>
            <p className="text-sm text-muted-foreground">Set a unit cost to see this.</p>
          </StatCard>
        );
      }
      const points = meterCostPerDay(resource, readings.data ?? []);
      return hasEnoughPoints(points) ? (
        <TrendLine
          key={resource.id}
          title={`${resource.name} cost per day`}
          icon={entityIconOf(resource.icon)}
          description="Worked out between each pair of your readings."
          points={points}
          tone={4}
          seriesLabel="Cost per day"
          formatValue={fmtMoney}
          formatTick={plain}
          formatDate={fmtDate}
          formatAxisDate={fmtShortDate}
          summary={`Per day, between readings · ${points.length} intervals`}
        />
      ) : (
        <StatCard key={resource.id} title={`${resource.name} cost per day`} icon={entityIconOf(resource.icon)}>
          <NotEnoughData hint="Needs readings on at least three different days." />
        </StatCard>
      );
    });

  return (
    <>
      <PageHeader
        title="Resources"
        description="Electricity, water and data: usage and cost worked out from your own readings."
        actions={<Button onClick={openCreate}>New resource</Button>}
      />

      {loading ? (
        <LoadingState rows={3} />
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            resources.refetch();
            readings.refetch();
          }}
        />
      ) : list.length === 0 ? (
        <EmptyState
          title="Nothing tracked yet"
          description="Track a meter like electricity or a quota like internet data, and Life OS works out usage and cost from your own readings."
          action={
            <div className="space-y-3">
              <Button onClick={openCreate}>Add a resource</Button>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTER_RESOURCES.map((starter) => (
                  <Button
                    key={starter.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    disabled={addStarter.isPending}
                    onClick={() => addStarter.mutate(starter)}
                  >
                    Add {starter.name}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                These are empty starting points with no figures. Edit or delete them freely.
              </p>
            </div>
          }
        />
      ) : (
        <>
          {glance.length ? <GlanceSection>{glance}</GlanceSection> : null}
          <ul className="space-y-4">
            {list.map((resource) => {
              const own = readingsFor(resource, readings.data ?? []);
              const latest = own[own.length - 1];
              const meter =
                resource.kind === "meter" ? meterFacts(resource, readings.data ?? []) : null;
              const quota =
                resource.kind === "quota" ? quotaFacts(resource, readings.data ?? []) : null;
              const needsMore = own.length < 2;

              return (
                <li key={resource.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <EntityIcon icon={resource.icon} color={resource.color} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{resource.name}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <SemanticBadge tone="neutral">
                            {RESOURCE_KINDS.find((k) => k.value === resource.kind)?.label}
                          </SemanticBadge>
                          <span className="text-muted-foreground">{resource.unit}</span>
                          {!resource.active ? (
                            <SemanticBadge tone="quiet">Inactive</SemanticBadge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button size="sm" onClick={() => openReading(resource)}>
                        <Plus className="size-4" />
                        Add reading
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(resource)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setToDelete(resource)}>
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    {latest ? (
                      <p className="text-muted-foreground">
                        Last reading {round(Number(latest.reading))} {resource.unit} ·{" "}
                        {fmtDate(latest.reading_at.slice(0, 10))}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">No readings yet.</p>
                    )}

                    {needsMore ? (
                      <p className="text-muted-foreground">
                        Add at least two readings and usage can be worked out.
                      </p>
                    ) : meter ? (
                      <dl className="grid min-w-0 gap-3 sm:grid-cols-3">
                        <div>
                          <dt className="text-muted-foreground">Used since last reading</dt>
                          <dd className="tabular-nums">
                            {meter.lastConsumption == null
                              ? "—"
                              : `${round(meter.lastConsumption)} ${resource.unit}`}
                            {meter.lastCost == null ? "" : ` · ${fmtMoney(meter.lastCost)}`}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Average a day</dt>
                          <dd className="tabular-nums">
                            {meter.perDay == null ? "—" : `${round(meter.perDay)} ${resource.unit}`}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">This cycle so far</dt>
                          <dd className="tabular-nums">
                            {meter.cycleConsumption == null
                              ? "—"
                              : `${round(meter.cycleConsumption)} ${resource.unit}`}
                            {meter.cycleCost == null ? "" : ` · ${fmtMoney(meter.cycleCost)}`}
                          </dd>
                        </div>
                        {meter.tier?.current ? (
                          <div className="sm:col-span-3">
                            <TierMeter
                              tariff={meter.tier.tariff}
                              kwh={meter.cycleConsumption ?? 0}
                              unit={resource.unit}
                              projectedTier={meter.tier.projected?.tier ?? null}
                            />
                          </div>
                        ) : null}
                        {meter.projectedCycleCost != null ? (
                          <div className="sm:col-span-3">
                            <dt className="text-muted-foreground">
                              Projected cost for the full cycle
                              {meter.cycleEnd ? ` to ${fmtDate(meter.cycleEnd)}` : ""}
                            </dt>
                            <dd className="tabular-nums">{fmtMoney(meter.projectedCycleCost)}</dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : quota ? (
                      <>
                        {quota.tier ? (
                          <TierMeter
                            tariff={quota.tier.tariff}
                            kwh={quota.tier.used}
                            unit={resource.unit}
                            projectedTier={null}
                          />
                        ) : null}
                        <dl className="grid min-w-0 gap-3 sm:grid-cols-3">
                          <div>
                            <dt className="text-muted-foreground">Left</dt>
                            <dd className="tabular-nums">
                              {round(quota.remaining)} {resource.unit}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Average a day</dt>
                            <dd className="tabular-nums">
                              {quota.perDay == null
                                ? "—"
                                : `${round(quota.perDay)} ${resource.unit}`}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">At that rate</dt>
                            <dd className="tabular-nums">
                              {quota.daysLeft == null
                                ? "—"
                                : `about ${Math.floor(quota.daysLeft)} ${Math.floor(quota.daysLeft) === 1 ? "day" : "days"} left`}
                            </dd>
                          </div>
                          {quota.runsOutOn && quota.cycleEnd ? (
                            <div className="sm:col-span-3 text-muted-foreground">
                              {quota.runsOutBeforeCycleEnd
                                ? `At this rate it reaches zero around ${fmtDate(quota.runsOutOn)}, before the cycle ends on ${fmtDate(quota.cycleEnd)}.`
                                : `At this rate it lasts past the cycle end on ${fmtDate(quota.cycleEnd)}.`}
                            </div>
                          ) : null}
                        </dl>
                      </>
                    ) : null}

                    {meter && meter.cycleCost != null && resource.category_id ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={logCost.isPending}
                        onClick={() =>
                          logCost.mutate({
                            resource,
                            amount: meter.cycleCost as number,
                            label: `${resource.name} · ${round(meter.cycleConsumption ?? 0)} ${resource.unit}`,
                          })
                        }
                      >
                        Log {fmtMoney(meter.cycleCost)} as a transaction
                      </Button>
                    ) : null}
                  </div>
                  {own.length >= 2 && resource.kind !== "vehicle" ? (
                    <ResourceUsage
                      kind={resource.kind}
                      unit={resource.unit}
                      color={resource.color}
                      readings={own}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit resource" : "New resource"}
        pending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="resource-name">Name</Label>
          <Input
            id="resource-name"
            required
            className="h-12"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <EntityIdentityPicker
          value={{ icon: form.icon, color: form.color }}
          onChange={(identity) => setForm({ ...form, ...identity })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Kind</Label>
            <Select
              value={form.kind}
              onValueChange={(v) => setForm({ ...form, kind: v as ResourceInput["kind"] })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_KINDS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {RESOURCE_KINDS.find((k) => k.value === form.kind)?.hint}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="resource-unit">Unit</Label>
            <Input
              id="resource-unit"
              required
              className="h-12"
              placeholder="kWh, GB, m³"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </div>
          {form.kind === "meter" || form.kind === "quota" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Pricing</Label>
              <Select
                value={form.tariff ? "tiered" : "flat"}
                onValueChange={(value) =>
                  setForm({ ...form, tariff: value === "tiered" ? EGYPT_RESIDENTIAL_2026 : null })
                }
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">One price per unit</SelectItem>
                  <SelectItem value="tiered">Tiers 1–7 (Egypt residential)</SelectItem>
                </SelectContent>
              </Select>
              {form.tariff ? (
                <TariffEditor
                  tariff={form.tariff}
                  onChange={(tariff) => setForm({ ...form, tariff })}
                />
              ) : null}
            </div>
          ) : null}
          <div className={form.tariff ? "hidden" : "space-y-2"}>
            <Label htmlFor="resource-cost">Cost per unit</Label>
            <Input
              id="resource-cost"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              className="h-12 tabular-nums"
              value={form.unit_cost ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  unit_cost: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
          {form.kind === "quota" ? (
            <div className="space-y-2">
              <Label htmlFor="resource-quota">Quota amount</Label>
              <Input
                id="resource-quota"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                className="h-12 tabular-nums"
                value={form.quota_amount ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    quota_amount: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="resource-cycle-start">Cycle starts</Label>
            <DatePicker
              id="resource-cycle-start"
              value={form.cycle_start_date}
              onChange={(value) => setForm({ ...form, cycle_start_date: value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resource-cycle-count">Cycle length</Label>
            <div className="flex gap-2">
              <Input
                id="resource-cycle-count"
                type="number"
                min="1"
                inputMode="numeric"
                aria-label="Cycle length amount"
                className="h-12 w-24 tabular-nums"
                value={
                  form.cycle_unit === "days" ? (form.cycle_days ?? "") : (form.cycle_count ?? "")
                }
                onChange={(e) => {
                  const value = e.target.value === "" ? null : Number(e.target.value);
                  setForm(
                    form.cycle_unit === "days"
                      ? { ...form, cycle_days: value }
                      : { ...form, cycle_count: value ?? 1 },
                  );
                }}
              />
              <Select
                value={form.cycle_unit === "days" ? "days" : "months"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    cycle_unit: v === "days" ? "days" : "months",
                  })
                }
              >
                <SelectTrigger className="h-12 flex-1" aria-label="Cycle length unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="months">months</SelectItem>
                  <SelectItem value="days">days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Months follow the calendar, so a cycle keeps its start day each month.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Money category</Label>
            <Select
              value={form.category_id ?? "none"}
              onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? null : v })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {(categories.data ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Account for costs</Label>
            <Select
              value={form.account_id ?? "none"}
              onValueChange={(v) => setForm({ ...form, account_id: v === "none" ? null : v })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No account</SelectItem>
                {(accounts.data ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.active ? "active" : "inactive"}
              onValueChange={(v) => setForm({ ...form, active: v === "active" })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={!!readingFor}
        onOpenChange={(open) => !open && setReadingFor(null)}
        title={readingFor ? `Add reading · ${readingFor.name}` : "Add reading"}
        submitLabel="Add reading"
        pending={logReading.isPending}
        onSubmit={() => logReading.mutate()}
      >
        {readingFor ? (
          <div className="space-y-2">
            <Label htmlFor="reading-value">
              {readingFor.kind === "meter"
                ? `Meter reading (${readingFor.unit})`
                : `Amount left (${readingFor.unit})`}
            </Label>
            <Input
              id="reading-value"
              autoFocus
              inputMode="decimal"
              type="number"
              step="any"
              className="h-14 text-lg tabular-nums"
              value={readingValue}
              onChange={(event) => setReadingValue(event.target.value)}
            />
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="reading-at">Taken on</Label>
              <Input
                id="reading-at"
                type="datetime-local"
                className="h-11 tabular-nums"
                value={readingAt}
                max={isoToLocalInput(new Date().toISOString())}
                onChange={(event) => setReadingAt(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Change this to add a reading from earlier.
              </p>
            </div>
            {(() => {
              const own = readingsFor(readingFor, readings.data ?? []);
              const last = own[own.length - 1];
              return last ? (
                <p className="text-xs text-muted-foreground">
                  Last reading: {round(Number(last.reading))} {readingFor.unit} on{" "}
                  {fmtDate(last.reading_at.slice(0, 10))}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">This will be your first reading.</p>
              );
            })()}
            {(() => {
              const value = Number(readingValue);
              if (readingValue === "" || Number.isNaN(value)) return null;
              const usage = tierUsage(readingFor, readings.data ?? [], {
                reading: value,
                at: readingAt ? localInputToISO(readingAt) : new Date().toISOString(),
              });
              if (!usage) return null;
              return (
                <div className="rounded-lg bg-secondary p-3 text-sm">
                  <p className="font-medium">
                    With this reading: {round(usage.used)} {readingFor.unit} this month · tier{" "}
                    {usage.bill.tier} of {usage.tariff.tiers.length}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {usage.until
                      ? `${Math.ceil(usage.until.kwh)} ${readingFor.unit} left before tier ${usage.until.next}. `
                      : "Highest tier. "}
                    About {fmtMoney(usage.bill.total)} so far this month.
                  </p>
                </div>
              );
            })()}
          </div>
        ) : null}
      </FormDialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Remove this resource?"
        description="Its readings are removed with it."
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}

/** Where this cycle's consumption sits across the tiers. */
function TierMeter({
  tariff,
  kwh,
  unit,
  projectedTier,
}: {
  tariff: Tariff;
  kwh: number;
  unit: string;
  projectedTier: number | null;
}) {
  const tier = tierFor(tariff, kwh);
  const until = untilNextTier(tariff, kwh);
  return (
    <div className="space-y-2 rounded-lg bg-secondary p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          Tier {tier} of {tariff.tiers.length}
          <span className="ml-2 font-normal text-muted-foreground">
            {tierRangeLabel(tariff, tier, unit)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {until ? `${Math.ceil(until.kwh)} ${unit} until tier ${until.next}` : "Highest tier"}
          {projectedTier != null && projectedTier !== tier
            ? ` · at this pace: tier ${projectedTier}`
            : ""}
        </p>
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${tariff.tiers.length}, minmax(0, 1fr))` }}
      >
        {tariff.tiers.map((_, index) => (
          <span
            key={index}
            title={`Tier ${index + 1}: ${tierRangeLabel(tariff, index + 1, unit)}`}
            className="h-2 rounded-full"
            style={{
              background:
                index + 1 < tier
                  ? "color-mix(in oklch, var(--chart-4) 55%, transparent)"
                  : index + 1 === tier
                    ? "var(--chart-4)"
                    : "var(--color-border)",
            }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {tariff.name} · {tariff.source}
      </p>
    </div>
  );
}

/** Rates and fees per tier, editable when prices change. */
function TariffEditor({
  tariff,
  onChange,
}: {
  tariff: Tariff;
  onChange: (tariff: Tariff) => void;
}) {
  const set = (index: number, key: "rate" | "fee", value: string) =>
    onChange({
      ...tariff,
      source: "Edited",
      tiers: tariff.tiers.map((tier, i) =>
        i === index ? { ...tier, [key]: Number(value) || 0 } : tier,
      ),
    });
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Tier</th>
            <th className="px-3 py-2 text-left font-medium">Per kWh</th>
            <th className="px-3 py-2 text-left font-medium">Monthly fee</th>
          </tr>
        </thead>
        <tbody>
          {tariff.tiers.map((tier, index) => (
            <tr key={index} className="border-t border-border">
              <td className="px-3 py-1.5">
                <span className="font-medium">{index + 1}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {tierRangeLabel(tariff, index + 1)}
                </span>
              </td>
              <td className="px-3 py-1.5">
                <Input
                  aria-label={`Tier ${index + 1} price per kWh`}
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className="h-9 w-24 tabular-nums"
                  value={tier.rate}
                  onChange={(event) => set(index, "rate", event.target.value)}
                />
              </td>
              <td className="px-3 py-1.5">
                <Input
                  aria-label={`Tier ${index + 1} monthly fee`}
                  type="number"
                  step="0.5"
                  min="0"
                  inputMode="decimal"
                  className="h-9 w-20 tabular-nums"
                  value={tier.fee}
                  onChange={(event) => set(index, "fee", event.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>{tariff.source}</span>
        <button
          type="button"
          className="underline underline-offset-4 hover:text-foreground"
          onClick={() => onChange(EGYPT_RESIDENTIAL_2026)}
        >
          Reset to official rates
        </button>
      </div>
    </div>
  );
}
