import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Flame,
  HeartPulse,
  Info,
  ListChecks,
  Moon,
  Repeat,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { transactionsQuery } from "@/data/finance";
import { habitLogsQuery, habitsQuery } from "@/data/habits";
import { medicationLogsQuery, medicationsQuery } from "@/data/health";
import { healthSamplesQuery } from "@/data/healthSamples";
import { buildHub, levelFor, statFor, type Dimension, type DimensionLine } from "@/data/hub";
import type { ModuleKey } from "@/data/modules";
import { prayerLogsQuery } from "@/data/spirit";
import { tasksQuery } from "@/data/tasks";
import { useModules } from "@/hooks/useModules";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";

const META: Record<Dimension, { icon: LucideIcon; module: ModuleKey; to: string; tone: number }> = {
  body: { icon: HeartPulse, module: "body", to: "/health", tone: 3 },
  money: { icon: Wallet, module: "money", to: "/finance", tone: 4 },
  work: { icon: ListChecks, module: "do", to: "/week", tone: 1 },
  spirit: { icon: Moon, module: "spirit", to: "/spirit", tone: 2 },
  habits: { icon: Repeat, module: "habits", to: "/habits", tone: 5 },
};

/**
 * The life snapshot at the top of Today. Serious skin: counts for the last 7
 * days. RPG skin: the same rows as XP, levels and 0–100 stats.
 */
export function HubCard() {
  const { skin } = usePreferences();
  const { enabled } = useModules();
  const tasks = useQuery(tasksQuery());
  const prayerLogs = useQuery(prayerLogsQuery());
  const medications = useQuery(medicationsQuery());
  const medicationLogs = useQuery(medicationLogsQuery());
  const habits = useQuery(habitsQuery());
  const habitLogs = useQuery(habitLogsQuery());
  const transactions = useQuery(transactionsQuery());
  const healthSamples = useQuery(healthSamplesQuery(365));

  const hub = buildHub({
    today: todayISO(),
    tasks: tasks.data ?? [],
    prayerLogs: prayerLogs.data ?? [],
    medications: medications.data ?? [],
    medicationLogs: medicationLogs.data ?? [],
    habits: habits.data ?? [],
    habitLogs: habitLogs.data ?? [],
    transactions: transactions.data ?? [],
    healthSamples: healthSamples.data ?? [],
    enabled: (dimension) => enabled.includes(META[dimension].module),
  });
  if (!hub.lines.length) return null;

  return skin === "rpg" ? <RpgSheet hub={hub} /> : <SeriousHub lines={hub.lines} />;
}

/**
 * Serious: the same card layout and bars as the RPG sheet, but each bar is a
 * plain "done of scheduled" count with its real denominator — no levels, XP
 * or 0–100 scores.
 */
function SeriousHub({ lines }: { lines: DimensionLine[] }) {
  return (
    <section className="stat-card space-y-4 p-5" aria-label="Last 7 days">
      <p className="text-xs font-medium text-muted-foreground">
        Last 7 days
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {lines.map((line) => {
          const { icon: Icon, to, tone } = META[line.key];
          return (
            <li key={line.key}>
              <Link
                to={to}
                className="block rounded-xl bg-secondary/70 p-3 transition-colors hover:bg-secondary"
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className="size-4"
                    style={{ color: `var(--chart-${tone})` }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold">{line.label}</span>
                </div>
                <p className="mt-2 text-xs tabular-nums text-muted-foreground">{line.count}</p>
                {line.ratio && line.ratio.total > 0 ? (
                  <XpBar
                    into={line.ratio.done}
                    span={line.ratio.total}
                    tone={tone}
                    label={`${line.label}: ${line.count}`}
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RpgSheet({ hub }: { hub: ReturnType<typeof buildHub> }) {
  const overall = levelFor(hub.totalXp);
  return (
    <section className="stat-card space-y-4 p-5" aria-label="Character sheet">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Character
          </p>
          <p className="text-2xl font-semibold tracking-tight">
            Level {overall.level}
            <span className="ml-2 text-sm font-normal tabular-nums text-muted-foreground">
              {hub.totalXp} XP
            </span>
          </p>
        </div>
        {hub.prayerStreak > 1 ? (
          <span className="tone-info inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
            <Flame className="size-3.5" aria-hidden="true" />
            {hub.prayerStreak}-day prayer streak
          </span>
        ) : null}
      </div>
      <XpBar
        into={overall.into}
        span={overall.span}
        tone={1}
        label={`${overall.into} of ${overall.span} XP to level ${overall.level + 1}`}
      />

      <ul className="grid gap-3 sm:grid-cols-2">
        {hub.lines.map((line) => {
          const { icon: Icon, tone } = META[line.key];
          const level = levelFor(line.xp);
          const stat = statFor(line.ratio);
          return (
            <li key={line.key} className="rounded-xl bg-secondary/70 p-3">
              <div className="flex items-center gap-2">
                <Icon
                  className="size-4"
                  style={{ color: `var(--chart-${tone})` }}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold">{line.label}</span>
                <span className="text-xs text-muted-foreground">{line.maslow}</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="ml-auto rounded-full p-1 text-muted-foreground hover:text-foreground"
                      aria-label={`How ${line.label} is worked out`}
                    >
                      <Info className="size-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 text-sm">
                    <p className="mb-1 font-medium">How this is worked out</p>
                    <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                      {line.explain.map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                      <li>Right now: {line.count}.</li>
                    </ul>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="mt-2 flex items-baseline justify-between text-xs">
                <span className="font-medium">Lv {level.level}</span>
                <span className="tabular-nums text-muted-foreground">
                  {stat == null ? "no stat yet" : `${stat}/100`}
                </span>
              </div>
              <XpBar
                into={stat ?? 0}
                span={100}
                tone={tone}
                label={
                  stat == null ? `${line.label}: no stat yet` : `${line.label} stat ${stat} of 100`
                }
              />
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="size-3" aria-hidden="true" />
        Every point comes from something you logged. Tap ⓘ to see how.
      </p>
    </section>
  );
}

function XpBar({
  into,
  span,
  tone,
  label,
}: {
  into: number;
  span: number;
  tone: number;
  label: string;
}) {
  const width = span ? Math.min(100, Math.round((into / span) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={into}
      aria-valuemin={0}
      aria-valuemax={span}
      className="mt-1.5 h-2 overflow-hidden rounded-full"
      style={{ background: `color-mix(in oklch, var(--chart-${tone}) 16%, transparent)` }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${width}%`, background: `var(--chart-${tone})` }}
      />
    </div>
  );
}
