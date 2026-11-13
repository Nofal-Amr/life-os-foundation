import type { Circle, LinkKind, Relation } from "@/data/relationships";

export const selectClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** A sensible circle for a relation, so most people need one choice, not two. */
export function defaultCircle(relation: Relation): Exclude<Circle, "me"> {
  if (["father", "mother", "parent", "spouse", "child"].includes(relation)) return "closest";
  if (["sibling", "grandparent"].includes(relation)) return "family";
  if (["uncle_aunt", "cousin", "nephew_niece", "relative"].includes(relation)) return "relatives";
  if (relation === "colleague") return "work";
  return "friends";
}

/** How a new person usually links to the one they're added under. */
export function defaultLinkKind(relation: Relation): LinkKind {
  if (["father", "mother", "parent", "grandparent"].includes(relation)) return "parent";
  if (["sibling", "uncle_aunt"].includes(relation)) return "sibling";
  if (["child", "nephew_niece"].includes(relation)) return "child";
  if (relation === "spouse") return "spouse";
  if (relation === "cousin") return "cousin";
  if (relation === "friend") return "friend";
  if (relation === "colleague") return "colleague";
  return "other";
}
