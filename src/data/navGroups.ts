import {
  Bell,
  Briefcase,
  CalendarDays,
  CalendarRange,
  FileInput,
  GraduationCap,
  LineChart,
  MessageSquare,
  Network,
  NotebookPen,
  Sunset,
  Swords,
  Timer,
  Users,
} from "lucide-react";

import type { ModuleKey } from "@/data/modules";
import type { FileRoutesByTo } from "@/routeTree.gen";

type Tool = {
  to: keyof FileRoutesByTo;
  label: string;
  icon: typeof CalendarDays;
  module: ModuleKey | null;
};

/**
 * Everything beyond the five sections, in three groups: what's coming and
 * how it went (Plan), what you keep (Library), and other people (Shared).
 */
export const TOOL_GROUPS: { label: string; tools: Tool[] }[] = [
  {
    label: "Plan",
    tools: [
      { to: "/calendar", label: "Calendar", icon: CalendarDays, module: "calendar" },
      { to: "/week", label: "Week", icon: CalendarRange, module: null },
      { to: "/reminders", label: "Reminders", icon: Bell, module: null },
      { to: "/review", label: "Daily review", icon: Sunset, module: null },
      { to: "/time", label: "Time", icon: Timer, module: null },
      { to: "/insights", label: "Insights", icon: LineChart, module: null },
      { to: "/quests", label: "Quests", icon: Swords, module: null },
    ],
  },
  {
    label: "Library",
    tools: [
      { to: "/notes", label: "Notes", icon: NotebookPen, module: "notes" },
      { to: "/study", label: "Study", icon: GraduationCap, module: "study" },
      { to: "/import-plan", label: "Import a plan", icon: FileInput, module: "do" },
    ],
  },
  {
    label: "Shared",
    tools: [
      { to: "/relationships", label: "Relationships", icon: Network, module: "relationships" },
      { to: "/together", label: "Together", icon: Users, module: null },
      { to: "/work", label: "Work", icon: Briefcase, module: null },
      { to: "/messages", label: "Messages", icon: MessageSquare, module: null },
    ],
  },
];

/**
 * The groups this user sees: only areas they kept, Quests only in the RPG
 * skin, Work only once in a company. Empty groups are left out.
 */
export function visibleToolGroups({
  enabled,
  skin,
  inCompany,
}: {
  enabled: readonly string[];
  skin: string;
  inCompany: boolean;
}) {
  return TOOL_GROUPS.map((group) => ({
    label: group.label,
    tools: group.tools.filter(
      (item) =>
        (!item.module || enabled.includes(item.module)) &&
        (item.to !== "/quests" || skin === "rpg") &&
        (item.to !== "/work" || inCompany),
    ),
  })).filter((group) => group.tools.length > 0);
}
