import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { useState } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { ClockCard } from "@/components/app/work/ClockCard";
import { MemberMonth, MonthNav, useMonthPicker } from "@/components/app/work/MyMonth";
import { useMonthSheet } from "@/components/app/work/useMonthSheet";
import { PeopleAdmin } from "@/components/app/work/PeopleAdmin";
import { PlacesAdmin } from "@/components/app/work/PlacesAdmin";
import { RulesEditor } from "@/components/app/work/RulesEditor";
import { SheetsAdmin } from "@/components/app/work/SheetsAdmin";
import { Button } from "@/components/ui/button";
import {
  readRules,
  workMembersQuery,
  workOrgsQuery,
  workPlacesQuery,
  type WorkMember,
  type WorkOrg,
} from "@/data/work/api";
import type { WorkRules } from "@/data/work/rules";
import { useAuth } from "@/hooks/useAuth";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/work")({
  head: () => ({
    meta: [
      { title: "Work · Life OS" },
      {
        name: "description",
        content: "Clock in and out, and the month's attendance and pay sheet.",
      },
    ],
  }),
  component: WorkPage,
});

const ORG_KEY = "lifeos:work-org";

function WorkPage() {
  const orgs = useQuery(workOrgsQuery());
  const [chosen, setChosen] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ORG_KEY);
    } catch {
      return null;
    }
  });

  if (orgs.isLoading) return <LoadingState rows={4} />;
  if (orgs.error) return <ErrorState error={orgs.error} onRetry={() => void orgs.refetch()} />;
  const list = orgs.data ?? [];
  if (!list.length) {
    return (
      <>
        <PageHeader title="Work" />
        <EmptyState
          title="You're not in a company yet"
          description="Make a test company or join one with a code in Settings → Work."
          action={
            <Button asChild>
              <Link to="/settings">{t("Open Settings")}</Link>
            </Button>
          }
        />
      </>
    );
  }
  const org = list.find((item) => item.id === chosen) ?? list[0]!;
  return (
    <WorkSpace
      key={org.id}
      org={org}
      others={list}
      onPick={(id) => {
        setChosen(id);
        try {
          localStorage.setItem(ORG_KEY, id);
        } catch {
          // This visit only.
        }
      }}
    />
  );
}

export type WorkTab = "today" | "people" | "places" | "rules" | "sheets";

function WorkSpace({
  org,
  others,
  onPick,
}: {
  org: WorkOrg;
  others: WorkOrg[];
  onPick: (id: string) => void;
}) {
  const { user } = useAuth();
  const rules = readRules(org.rules);
  const members = useQuery(workMembersQuery(org.id));
  const places = useQuery(workPlacesQuery(org.id));
  const [tab, setTab] = useState<WorkTab>("today");
  const me = (members.data ?? []).find((member) => member.user_id === user?.id) ?? null;
  const admin = me?.role === "owner" || me?.role === "admin";

  if (members.isLoading || places.isLoading) return <LoadingState rows={4} />;
  if (!me)
    return <ErrorState error={new Error(t("You're not a member of this company any more."))} />;

  const tabs: { value: WorkTab; label: string }[] = [
    { value: "today", label: "Today" },
    ...(admin
      ? ([
          { value: "people", label: "People" },
          { value: "places", label: "Places" },
          { value: "rules", label: "Rules" },
          { value: "sheets", label: "Sheets" },
        ] as const)
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Work"
        description={org.name}
        actions={
          others.length > 1 ? (
            <select
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
              value={org.id}
              onChange={(event) => onPick(event.target.value)}
              aria-label={t("Company")}
            >
              {others.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          ) : null
        }
      />
      {tabs.length > 1 ? (
        <div className="mb-5 flex flex-wrap gap-1 rounded-xl bg-secondary p-1" role="tablist">
          {tabs.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={tab === option.value}
              onClick={() => setTab(option.value)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                tab === option.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "today" ? (
        <TodayTab org={org} rules={rules} me={me} />
      ) : (
        <AdminTab tab={tab} org={org} rules={rules} me={me} />
      )}
    </>
  );
}

function TodayTab({ org, rules, me }: { org: WorkOrg; rules: WorkRules; me: WorkMember }) {
  const places = useQuery(workPlacesQuery(org.id));
  const { month, step } = useMonthPicker();
  const thisMonth = format(new Date(), "yyyy-MM");
  const { events } = useMonthSheet(org, rules, thisMonth, me);
  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: rules.timezone });
  const today = (events ?? []).filter(
    (event) =>
      new Date(event.at).toLocaleDateString("en-CA", { timeZone: rules.timezone }) === todayKey,
  );
  return (
    <div className="space-y-6">
      <ClockCard org={org} rules={rules} member={me} places={places.data ?? []} today={today} />
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t("Your month")}</h2>
          <MonthNav month={month} step={step} />
        </div>
        <MemberMonth org={org} rules={rules} member={me} month={month} />
      </section>
    </div>
  );
}

/** Owners and admins: people, places, rules and everyone's sheets. */
function AdminTab({
  tab,
  org,
  rules,
  me,
}: {
  tab: WorkTab;
  org: WorkOrg;
  rules: WorkRules;
  me: WorkMember;
}) {
  if (tab === "people") return <PeopleAdmin org={org} me={me} />;
  if (tab === "places") return <PlacesAdmin org={org} />;
  if (tab === "rules") return <RulesEditor key={org.updated_at} org={org} rules={rules} />;
  if (tab === "sheets") return <SheetsAdmin org={org} rules={rules} />;
  return null;
}
