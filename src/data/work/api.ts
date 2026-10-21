/**
 * The work side's data: companies, members, places, clock events,
 * corrections and leave (Supabase, row-level security per company), and
 * the bridge from those rows to the rules engine.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { unwrap } from "@/lib/supabase-helpers";

import { ADO_PRESET, type ClockEvent, type Correction, type Leave, type WorkRules } from "./rules";

type Tables = Database["public"]["Tables"];
export type WorkOrg = Tables["work_orgs"]["Row"];
export type WorkMember = Tables["work_members"]["Row"];
export type WorkPlace = Tables["work_places"]["Row"];
export type WorkEvent = Tables["work_events"]["Row"];
export type WorkCorrection = Tables["work_corrections"]["Row"];
export type WorkLeave = Tables["work_leaves"]["Row"];

export const workKeys = {
  all: ["work"] as const,
  orgs: ["work", "orgs"] as const,
  members: (org: string) => ["work", "members", org] as const,
  places: (org: string) => ["work", "places", org] as const,
  events: (org: string, month: string) => ["work", "events", org, month] as const,
  corrections: (org: string, month: string) => ["work", "corrections", org, month] as const,
  leaves: (org: string, month: string) => ["work", "leaves", org, month] as const,
};

/** The month's first day and the next month's, for range queries. */
function monthRange(month: string): { from: string; to: string } {
  const [year, number] = month.split("-").map(Number);
  const next =
    number === 12 ? `${year! + 1}-01` : `${year}-${String(number! + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
}

/** Saved rules with anything missing filled from the preset, so old rules keep working. */
export function readRules(json: unknown): WorkRules {
  const saved = json && typeof json === "object" ? (json as Partial<WorkRules>) : {};
  return {
    ...ADO_PRESET,
    ...saved,
    overtime: { ...ADO_PRESET.overtime, ...(saved.overtime ?? {}) },
  };
}

/* ---------------------------------------------------------------- queries */

export const workOrgsQuery = () =>
  queryOptions({
    queryKey: workKeys.orgs,
    queryFn: async () =>
      unwrap(await supabase.from("work_orgs").select("*").order("created_at")) as WorkOrg[],
  });

export const workMembersQuery = (orgId: string) =>
  queryOptions({
    queryKey: workKeys.members(orgId),
    queryFn: async () =>
      unwrap(
        await supabase.from("work_members").select("*").eq("org_id", orgId).order("joined_at"),
      ) as WorkMember[],
  });

export const workPlacesQuery = (orgId: string) =>
  queryOptions({
    queryKey: workKeys.places(orgId),
    queryFn: async () =>
      unwrap(
        await supabase.from("work_places").select("*").eq("org_id", orgId).order("created_at"),
      ) as WorkPlace[],
  });

/** Events from a day before the month (an overnight shift) to a day after. */
export const workEventsQuery = (orgId: string, month: string) =>
  queryOptions({
    queryKey: workKeys.events(orgId, month),
    queryFn: async () => {
      const { from, to } = monthRange(month);
      const before = new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000).toISOString();
      const after = new Date(Date.parse(`${to}T00:00:00Z`) + 86_400_000).toISOString();
      return unwrap(
        await supabase
          .from("work_events")
          .select("*")
          .eq("org_id", orgId)
          .gte("at", before)
          .lt("at", after)
          .order("at"),
      ) as WorkEvent[];
    },
  });

export const workCorrectionsQuery = (orgId: string, month: string) =>
  queryOptions({
    queryKey: workKeys.corrections(orgId, month),
    queryFn: async () => {
      const { from, to } = monthRange(month);
      return unwrap(
        await supabase
          .from("work_corrections")
          .select("*")
          .eq("org_id", orgId)
          .gte("day", from)
          .lt("day", to)
          .order("created_at"),
      ) as WorkCorrection[];
    },
  });

export const workLeavesQuery = (orgId: string, month: string) =>
  queryOptions({
    queryKey: workKeys.leaves(orgId, month),
    queryFn: async () => {
      const { from, to } = monthRange(month);
      return unwrap(
        await supabase
          .from("work_leaves")
          .select("*")
          .eq("org_id", orgId)
          .gte("day", from)
          .lt("day", to)
          .order("day"),
      ) as WorkLeave[];
    },
  });

/* -------------------------------------------------------------- mutations */

export async function createWorkOrg(name: string, myName: string): Promise<string> {
  return unwrap(
    await supabase.rpc("create_work_org", {
      org_name: name,
      my_name: myName,
      org_rules: ADO_PRESET as unknown as Json,
    }),
  ) as string;
}

export async function joinWorkOrg(code: string, myName: string): Promise<string> {
  return unwrap(
    await supabase.rpc("join_work_org", { code: code.trim().toUpperCase(), my_name: myName }),
  ) as string;
}

export async function renewWorkCode(orgId: string): Promise<string> {
  return unwrap(await supabase.rpc("renew_work_code", { target: orgId })) as string;
}

export async function saveRules(orgId: string, rules: WorkRules): Promise<void> {
  unwrap(
    await supabase
      .from("work_orgs")
      .update({ rules: rules as unknown as Json })
      .eq("id", orgId)
      .select(),
  );
}

export type PlaceInput = Pick<
  WorkPlace,
  "name" | "kind" | "latitude" | "longitude" | "radius_m"
> & {
  id?: string;
};

export async function savePlace(orgId: string, place: PlaceInput): Promise<void> {
  if (place.id) {
    const { id, ...rest } = place;
    unwrap(await supabase.from("work_places").update(rest).eq("id", id).select());
  } else {
    unwrap(
      await supabase
        .from("work_places")
        .insert({ ...place, org_id: orgId })
        .select(),
    );
  }
}

export async function deletePlace(id: string): Promise<void> {
  unwrap(await supabase.from("work_places").delete().eq("id", id).select());
}

export type MemberPatch = Partial<
  Pick<WorkMember, "display_name" | "role" | "base_salary" | "overtime_rate" | "place_ids">
>;

export async function saveMember(orgId: string, userId: string, patch: MemberPatch): Promise<void> {
  unwrap(
    await supabase
      .from("work_members")
      .update(patch)
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .select(),
  );
}

export async function removeWorkMember(orgId: string, userId: string): Promise<void> {
  unwrap(
    await supabase.from("work_members").delete().eq("org_id", orgId).eq("user_id", userId).select(),
  );
}

export type EventInput = Pick<WorkEvent, "org_id" | "kind" | "at" | "verified"> &
  Partial<
    Pick<
      WorkEvent,
      | "place_id"
      | "place_kind"
      | "latitude"
      | "longitude"
      | "accuracy_m"
      | "distance_m"
      | "mock"
      | "reason"
    >
  >;

/** A clock-in, clock-out or attempt; the server stamps who and when it arrived. */
export async function recordEvent(input: EventInput): Promise<void> {
  unwrap(await supabase.from("work_events").insert(input).select());
}

export type CorrectionInput = Pick<
  WorkCorrection,
  "org_id" | "user_id" | "day" | "field" | "value" | "reason"
>;

export async function addCorrection(input: CorrectionInput): Promise<void> {
  unwrap(await supabase.from("work_corrections").insert(input).select());
}

export type LeaveInput = Pick<WorkLeave, "org_id" | "day" | "type_id"> &
  Partial<Pick<WorkLeave, "user_id" | "status" | "note">>;

export async function requestLeave(input: LeaveInput): Promise<void> {
  unwrap(await supabase.from("work_leaves").insert(input).select());
}

export async function approveLeave(id: string): Promise<void> {
  unwrap(await supabase.from("work_leaves").update({ status: "approved" }).eq("id", id).select());
}

export async function deleteLeave(id: string): Promise<void> {
  unwrap(await supabase.from("work_leaves").delete().eq("id", id).select());
}

/* ------------------------------------------------------- rows → the engine */

/**
 * One member's month as the rules engine's input. Attempts stay out of the
 * sheet; a leave correction counts as a leave; only approved leave counts.
 */
export function sheetInputFor(args: {
  member: Pick<WorkMember, "base_salary" | "overtime_rate">;
  rules: WorkRules;
  month: string;
  events: Pick<WorkEvent, "kind" | "at" | "place_kind">[];
  corrections: Pick<WorkCorrection, "day" | "field" | "value" | "reason">[];
  leaves: Pick<WorkLeave, "day" | "type_id" | "status">[];
  holidays: string[];
}) {
  const events: ClockEvent[] = args.events
    .filter((event) => event.kind === "in" || event.kind === "out")
    .map((event) => ({
      kind: event.kind as "in" | "out",
      at: event.at,
      ...(event.place_kind ? { placeKind: event.place_kind as "office" | "site" } : {}),
    }));
  const corrections: Correction[] = args.corrections
    .filter((item) => item.field === "in" || item.field === "out")
    .map((item) => ({
      day: item.day,
      field: item.field as "in" | "out",
      at: item.value,
      reason: item.reason,
    }));
  const leaves: Leave[] = [
    ...args.leaves
      .filter((leave) => leave.status === "approved")
      .map((leave) => ({ day: leave.day, typeId: leave.type_id })),
    ...args.corrections
      .filter((item) => item.field === "leave" && item.value)
      .map((item) => ({ day: item.day, typeId: item.value! })),
  ];
  return {
    rules: args.rules,
    month: args.month,
    baseSalary: Number(args.member.base_salary),
    overtimeRate: args.member.overtime_rate == null ? null : Number(args.member.overtime_rate),
    events,
    corrections,
    leaves,
    holidays: args.holidays,
  };
}
