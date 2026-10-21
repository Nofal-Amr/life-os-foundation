import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  sheetInputFor,
  workCorrectionsQuery,
  workEventsQuery,
  workLeavesQuery,
  type WorkMember,
  type WorkOrg,
} from "@/data/work/api";
import { monthSheet, type WorkRules } from "@/data/work/rules";

/**
 * One member's month sheet, worked out from the company's rows. RLS already
 * limits rows to what the viewer may see; this picks the one member.
 */
export function useMonthSheet(
  org: WorkOrg,
  rules: WorkRules,
  month: string,
  member: WorkMember | null,
) {
  const events = useQuery(workEventsQuery(org.id, month));
  const corrections = useQuery(workCorrectionsQuery(org.id, month));
  const leaves = useQuery(workLeavesQuery(org.id, month));
  const loading = events.isLoading || corrections.isLoading || leaves.isLoading;
  const error = events.error ?? corrections.error ?? leaves.error;

  const result = useMemo(() => {
    if (!member || !events.data || !corrections.data || !leaves.data) return null;
    const mine = <T extends { user_id: string }>(rows: T[]) =>
      rows.filter((row) => row.user_id === member.user_id);
    const memberCorrections = mine(corrections.data);
    return {
      sheet: monthSheet(
        sheetInputFor({
          member,
          rules,
          month,
          events: mine(events.data),
          corrections: memberCorrections,
          leaves: mine(leaves.data),
          // Company holidays come later; admins mark those days as leave.
          holidays: [],
        }),
      ),
      corrections: memberCorrections,
      events: mine(events.data),
    };
  }, [member, rules, month, events.data, corrections.data, leaves.data]);

  return { ...result, loading, error };
}
