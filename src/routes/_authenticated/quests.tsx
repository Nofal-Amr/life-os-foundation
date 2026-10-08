import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Award,
  Check,
  Coins,
  Lock,
  Plus,
  Shield,
  Swords,
  Target,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useHub } from "@/components/app/HubCard";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dhikrLogsQuery } from "@/data/azkar";
import {
  achievements,
  bosses,
  dailyQuests,
  goldBalance,
  shieldedStreak,
  titleFor,
  weeklyQuests,
  XP_PER_GOLD,
  type Quest,
} from "@/data/game";
import { levelFor } from "@/data/hub";
import { projectsQuery } from "@/data/projects";
import {
  addReward,
  buyReward,
  deleteReward,
  purchasesQuery,
  rewardsQuery,
  shopKeys,
  spentGold,
  undoPurchase,
} from "@/data/rpgShop";
import { useModules } from "@/hooks/useModules";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quests")({
  head: () => ({ meta: [{ title: "Quests · Life OS" }] }),
  component: QuestsPage,
});

function QuestsPage() {
  const queryClient = useQueryClient();
  const { skin, weekStartsOn, fmtDate } = usePreferences();
  const { enabled } = useModules();
  const data = useHub();
  const dhikr = useQuery(dhikrLogsQuery());
  const projects = useQuery(projectsQuery());
  const rewards = useQuery(rewardsQuery());
  const purchases = useQuery(purchasesQuery());
  const [rewardTitle, setRewardTitle] = useState("");
  const [rewardCost, setRewardCost] = useState("");

  const today = todayISO();
  const has = (area: string) => enabled.includes(area as never);
  const sources = {
    tasks: data.tasks,
    prayerLogs: data.prayerLogs,
    habitLogs: data.habitLogs,
    transactions: data.transactions,
    dhikrLogs: dhikr.data ?? [],
    healthSamples: data.healthSamples,
    projects: projects.data ?? [],
  };
  const level = levelFor(data.hub.totalXp);
  const { title, next } = titleFor(level.level);
  const streak = shieldedStreak(data.prayerLogs, today);
  const gold = goldBalance(data.hub.totalXp, spentGold(purchases.data ?? []));
  const list = achievements(sources);
  const earned = list
    .filter((a) => a.earnedOn)
    .sort((a, b) => b.earnedOn!.localeCompare(a.earnedOn!));
  const ahead = list
    .filter((a) => !a.earnedOn)
    .sort((a, b) => b.progress.have / b.progress.need - a.progress.have / a.progress.need);
  const fights = bosses(projects.data ?? [], data.tasks);

  const onError = (error: unknown) => toast.error(toError(error).message);
  const refreshShop = () => {
    void queryClient.invalidateQueries({ queryKey: shopKeys.rewards });
    void queryClient.invalidateQueries({ queryKey: shopKeys.purchases });
  };
  const add = useMutation({
    mutationFn: () => addReward(rewardTitle.trim(), Math.round(Number(rewardCost))),
    onSuccess: () => {
      setRewardTitle("");
      setRewardCost("");
      refreshShop();
    },
    onError,
  });
  const buy = useMutation({
    mutationFn: buyReward,
    onSuccess: (_, reward) => {
      refreshShop();
      toast.success(`Enjoy: ${reward.title}.`);
    },
    onError,
  });
  const undo = useMutation({ mutationFn: undoPurchase, onSuccess: refreshShop, onError });
  const removeReward = useMutation({ mutationFn: deleteReward, onSuccess: refreshShop, onError });

  return (
    <>
      <PageHeader
        title="Quests"
        description="Your game, from what you actually did. No random rewards, no made-up numbers."
      />
      {skin !== "rpg" ? (
        <p className="mb-5 rounded-lg border border-border bg-secondary/60 p-3 text-sm text-muted-foreground">
          This is the RPG skin's page. Switch the look to RPG in{" "}
          <Link to="/settings" className="underline">
            Settings
          </Link>{" "}
          to see it on Today too.
        </p>
      ) : null}

      <div className="space-y-6">
        <section className="stat-card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-2xl font-semibold">
              Level {level.level} <span className="text-primary">{title}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {level.into} of {level.span} XP to level {level.level + 1}
              {next ? ` · "${next.title}" at level ${next.level}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
              <Coins className="size-4" /> {gold.balance} gold
            </span>
            {has("spirit") ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                <Shield className="size-4" /> {streak.shields}{" "}
                {streak.shields === 1 ? "shield" : "shields"} · {streak.days}-day streak
              </span>
            ) : null}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <QuestList title="Today" quests={dailyQuests(sources, today, has)} />
          <QuestList title="This week" quests={weeklyQuests(sources, today, weekStartsOn, has)} />
        </div>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Swords className="size-5" /> Bosses
          </h2>
          {fights.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {fights.map((boss) => {
                const left = boss.hp - boss.hits;
                return (
                  <li key={boss.project.id} className="stat-card p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link to="/projects" className="font-semibold hover:underline">
                        {boss.project.name}
                      </Link>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {boss.defeated ? "Defeated" : `${left} of ${boss.hp} HP left`}
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-700",
                          boss.defeated ? "bg-muted-foreground" : "bg-primary",
                        )}
                        style={{ width: `${(left / boss.hp) * 100}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Every task done in it is a hit.
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Projects with tasks show up here as bosses.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Award className="size-5" /> Achievements
            <span className="text-sm font-normal text-muted-foreground">
              {earned.length} of {list.length}
            </span>
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {earned.map((item) => (
              <li key={item.id} className="stat-card flex items-start gap-3 p-3">
                <Award className="mt-0.5 size-5 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.description} Earned {fmtDate(item.earnedOn)}.
                  </span>
                </span>
              </li>
            ))}
            {ahead.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-dashed border-border p-3"
              >
                <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.description} {item.progress.have.toLocaleString()} of{" "}
                    {item.progress.need.toLocaleString()}.
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Coins className="size-5" /> Shop
            <span className="text-sm font-normal text-muted-foreground">
              {gold.balance} gold to spend
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Rewards you set yourself. Gold is {XP_PER_GOLD} XP each: {gold.earned} earned,{" "}
            {gold.spent} spent.
          </p>
          <ul className="space-y-2">
            {(rewards.data ?? []).map((reward) => (
              <li key={reward.id} className="stat-card flex items-center justify-between gap-3 p-3">
                <span className="text-sm font-medium">{reward.title}</span>
                <span className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={gold.balance < reward.cost || buy.isPending}
                    onClick={() => buy.mutate(reward)}
                  >
                    <Coins className="size-4" /> {reward.cost}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${reward.title}`}
                    onClick={() => removeReward.mutate(reward.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <form
            className="flex max-w-lg gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (rewardTitle.trim() && Number(rewardCost) >= 1) add.mutate();
            }}
          >
            <Input
              className="h-11"
              placeholder="Coffee out, an hour of gaming…"
              maxLength={80}
              value={rewardTitle}
              onChange={(e) => setRewardTitle(e.target.value)}
            />
            <Input
              className="h-11 w-24"
              inputMode="numeric"
              placeholder="Gold"
              value={rewardCost}
              onChange={(e) => setRewardCost(e.target.value.replace(/\D/g, ""))}
            />
            <Button
              type="submit"
              className="h-11"
              disabled={!rewardTitle.trim() || !rewardCost || add.isPending}
            >
              <Plus className="size-4" /> Add
            </Button>
          </form>
          {(purchases.data ?? []).length ? (
            <div className="space-y-1 pt-2">
              <p className="text-xs font-medium text-muted-foreground">Bought</p>
              <ul className="space-y-1 text-sm">
                {(purchases.data ?? []).slice(0, 8).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span>
                      {item.title}{" "}
                      <span className="text-xs text-muted-foreground">
                        · {fmtDate(item.bought_at.slice(0, 10))} · {item.cost} gold
                      </span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => undo.mutate(item.id)}>
                      <Undo2 className="size-4" /> Undo
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}

function QuestList({ title, quests }: { title: string; quests: Quest[] }) {
  return (
    <section className="stat-card space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Target className="size-4" /> {title}
        <span className="text-sm font-normal text-muted-foreground">
          {quests.filter((q) => q.done).length} of {quests.length}
        </span>
      </h2>
      <ul className="space-y-2.5">
        {quests.map((quest) => (
          <li key={quest.id}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span
                className={cn("flex items-center gap-2", quest.done && "text-muted-foreground")}
              >
                {quest.done ? <Check className="size-4 text-primary" /> : null}
                {quest.title}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {quest.have} / {quest.need}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${(quest.have / quest.need) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
