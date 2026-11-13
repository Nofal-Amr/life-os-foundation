import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Copy, FileUp, TriangleAlert } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { goalKeys } from "@/data/goals";
import { habitKeys } from "@/data/habits";
import { noteKeys } from "@/data/notes";
import {
  allKeys,
  importPlan,
  planItems,
  toggleItem,
  type ImportResult,
  type PlanItem,
} from "@/data/planImport";
import { projectKeys } from "@/data/projects";
import { taskKeys } from "@/data/tasks";
import { todayISO } from "@/lib/date";
import { exactDate, needsStartDate, parsePlan } from "@/lib/planMarkdown";
import { PLAN_PROMPTS, SAMPLE_CAREER_PLAN } from "@/lib/planPrompts";
import { toError } from "@/lib/supabase-helpers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/import-plan")({
  head: () => ({
    meta: [
      { title: "Import a plan · Life OS" },
      {
        name: "description",
        content:
          "Paste a plan written in plan markdown and turn it into a goal, projects and tasks.",
      },
    ],
  }),
  component: ImportPlanPage,
});

const KIND_LABEL: Record<PlanItem["kind"], string> = {
  goal: "Goal",
  project: "Project",
  task: "Task",
  step: "Step",
  habit: "Habit",
  notes: "Note",
};

function ImportPlanPage() {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [start, setStart] = useState(todayISO());
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const plan = useMemo(() => parsePlan(text), [text]);
  const startDate = exactDate(start);
  const usesStart = needsStartDate(plan);
  const items = useMemo(() => planItems(plan, startDate), [plan, startDate]);
  const keys = useMemo(() => allKeys(items), [items]);
  const selected = useMemo(() => new Set(keys.filter((k) => !unticked.has(k))), [keys, unticked]);
  const count = selected.size;

  const create = useMutation({
    mutationFn: () => importPlan(plan, selected, usesStart ? startDate : null),
    onSuccess: (result) => {
      for (const key of [goalKeys.all, projectKeys.all, taskKeys.all, habitKeys.all, noteKeys.all])
        void queryClient.invalidateQueries({ queryKey: key });
      setDone(result);
      toast.success("Plan imported.");
    },
    onError: (error) => toast.error(toError(error).message),
  });

  async function copy(promptText: string) {
    try {
      await navigator.clipboard.writeText(promptText);
      toast.success("Copied. Paste it into ChatGPT, Claude or any AI chat.");
    } catch {
      toast.error("Couldn't copy. Open docs/plan-markdown.md and copy it from there.");
    }
  }

  function setPlanText(value: string) {
    setText(value);
    setUnticked(new Set());
    setDone(null);
  }

  function toggle(item: PlanItem) {
    const next = toggleItem(selected, item);
    setUnticked(new Set(keys.filter((k) => !next.has(k))));
  }

  const hasPlan = items.length > 0;

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <PageHeader
        title="Import a plan"
        description="Paste a plan in plan markdown. Check what will be made, untick what you don't want, then create it."
      />

      <section className="mb-6 space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">1. Get a plan from your AI chat</h2>
        <p className="text-sm text-muted-foreground">
          Copy a prompt, fill in the brackets, and paste it into ChatGPT, Claude or any AI chat.
          Life OS doesn't send anything to an AI. You paste the answer below.
        </p>
        <div className="flex flex-wrap gap-2">
          {PLAN_PROMPTS.map((prompt) => (
            <Button
              key={prompt.id}
              type="button"
              variant="outline"
              onClick={() => copy(prompt.text)}
            >
              <Copy className="size-4" aria-hidden="true" />
              Copy prompt: {prompt.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="plan-text" className="text-sm font-semibold">
            2. Paste the plan
          </Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPlanText(SAMPLE_CAREER_PLAN)}
            >
              Try a sample
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="size-4" aria-hidden="true" />
              Upload .md
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              className="hidden"
              aria-label="Upload a plan file"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                if (file.size > 512 * 1024) {
                  toast.error("That file is too big for a plan.");
                  return;
                }
                setPlanText(await file.text());
              }}
            />
          </div>
        </div>
        <Textarea
          id="plan-text"
          value={text}
          onChange={(event) => setPlanText(event.target.value)}
          placeholder={"# Goal: …\n\n## Project: …\n### Week 1\n- [ ] A first task ~1h"}
          className="min-h-48 font-mono text-sm"
          data-testid="plan-text"
        />
        <p className="text-xs text-muted-foreground">
          The format is in <code>docs/plan-markdown.md</code>: <code># Goal:</code>,{" "}
          <code>## Project:</code>, <code>### Week 1</code>,{" "}
          <code>- [ ] Task @2026-11-20 !high #career ~2h</code>, <code>## Habits</code>,{" "}
          <code>## Notes</code>.
        </p>
      </section>

      {text.trim() ? (
        <section className="space-y-4" aria-label="Preview">
          <h2 className="text-sm font-semibold">3. Check and create</h2>

          {usesStart ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
              <Label htmlFor="plan-start" className="text-sm">
                Week 1 starts on
              </Label>
              <Input
                id="plan-start"
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="w-auto"
              />
              <p className="w-full text-xs text-muted-foreground">
                Tasks in "Week N" are due on the last day of that week, counted from this date.
                Tasks with a written date keep it.
              </p>
            </div>
          ) : null}

          {plan.warnings.length ? (
            <div className="space-y-1 rounded-xl border border-border bg-muted/40 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <TriangleAlert className="size-4" aria-hidden="true" />
                {plan.warnings.length === 1
                  ? "1 thing to check"
                  : `${plan.warnings.length} things to check`}
              </p>
              <ul className="space-y-0.5 text-muted-foreground" data-testid="plan-warnings">
                {plan.warnings.map((warning, index) => (
                  <li key={index}>
                    {warning.line ? `Line ${warning.line}: ` : ""}
                    {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {hasPlan ? (
            <ul
              className="space-y-1 rounded-xl border border-border bg-card p-2"
              data-testid="plan-tree"
            >
              {items.map((item) => (
                <TreeRow
                  key={item.key}
                  item={item}
                  selected={selected}
                  onToggle={toggle}
                  depth={0}
                />
              ))}
            </ul>
          ) : null}

          {done ? (
            <div
              className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm"
              role="status"
            >
              <p className="font-medium" data-testid="plan-done">
                Created {summary(done)}.
              </p>
              <div className="flex flex-wrap gap-2">
                {done.goal ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/goals">Open goals</Link>
                  </Button>
                ) : null}
                {done.projects ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/projects">Open projects</Link>
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" size="sm" onClick={() => setPlanText("")}>
                  Import another
                </Button>
              </div>
            </div>
          ) : hasPlan ? (
            <Button
              type="button"
              disabled={!count || create.isPending || (usesStart && !startDate)}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Creating…" : `Create ${count} ${count === 1 ? "item" : "items"}`}
            </Button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function summary(result: ImportResult): string {
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => {
    if (n) parts.push(`${n} ${n === 1 ? one : many}`);
  };
  add(result.goal, "goal", "goals");
  add(result.projects, "project", "projects");
  add(result.tasks, "task", "tasks");
  add(result.habits, "habit", "habits");
  add(result.notes, "note", "notes");
  return parts.join(", ") || "nothing";
}

function TreeRow({
  item,
  selected,
  onToggle,
  depth,
}: {
  item: PlanItem;
  selected: Set<string>;
  onToggle: (item: PlanItem) => void;
  depth: number;
}) {
  const id = `plan-item-${item.key}`;
  return (
    <li>
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-10 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/50",
          !selected.has(item.key) && "text-muted-foreground line-through",
        )}
        style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
      >
        <input
          id={id}
          type="checkbox"
          checked={selected.has(item.key)}
          onChange={() => onToggle(item)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span className="min-w-0 flex-1">
          <span className="mr-2 text-xs text-muted-foreground no-underline">
            {KIND_LABEL[item.kind]}
          </span>
          <span className="text-sm">{item.label}</span>
          {item.detail ? (
            <span className="ml-2 text-xs text-muted-foreground">{item.detail}</span>
          ) : null}
        </span>
      </label>
      {item.children.length ? (
        <ul>
          {item.children.map((child) => (
            <TreeRow
              key={child.key}
              item={child}
              selected={selected}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
