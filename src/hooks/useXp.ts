import { toast } from "sonner";

import { XP } from "@/data/hub";
import type { PrayerStatus } from "@/data/spirit";
import { usePreferences } from "@/hooks/usePreferences";

type Award =
  | { kind: "task" }
  | { kind: "transaction" }
  | { kind: "habit" }
  | { kind: "prayer"; status: PrayerStatus };

const DIMENSION: Record<Award["kind"], string> = {
  task: "Work",
  transaction: "Money",
  habit: "Habits",
  prayer: "Spirit",
};

const amountFor = (award: Award) =>
  award.kind === "prayer" ? XP.prayer[award.status] : XP[award.kind];

/**
 * RPG skin only: a small "+10 XP" moment when something is logged, using the
 * same XP values as the character sheet. In the Serious skin it does nothing.
 */
export function useXp() {
  const { skin } = usePreferences();
  const on = skin === "rpg";
  return {
    /** " · +10 XP" to append to an existing toast, or "" in the Serious skin. */
    suffix: (award: Award) => (on && amountFor(award) ? ` · +${amountFor(award)} XP` : ""),
    /** Shows its own toast, for actions that don't already show one. */
    toast: (award: Award) => {
      const amount = amountFor(award);
      if (on && amount) toast(`+${amount} XP`, { description: DIMENSION[award.kind], duration: 1800 });
    },
  };
}
