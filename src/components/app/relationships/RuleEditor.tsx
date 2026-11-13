import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  CIRCLES,
  RELATIONS,
  describeRule,
  ruleApplies,
  type Person,
  type Rule,
  type RuleAction,
  type RuleTopic,
  type ScopeType,
} from "@/data/relationships";
import type { RuleInput } from "@/data/relationshipsApi";

import { selectClass } from "./PersonForm";

const SCOPES: { value: ScopeType; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "circle", label: "A circle" },
  { value: "relation", label: "A kind of relation" },
  { value: "person", label: "One person" },
];

type Draft = {
  scope_type: ScopeType;
  scope_value: string;
  topic: RuleTopic;
  action: RuleAction;
  except: string[];
};

const blank: Draft = {
  scope_type: "relation",
  scope_value: "cousin",
  topic: "birthday",
  action: "quiet",
  except: [],
};

const toInput = (draft: Draft): RuleInput => ({
  scope_type: draft.scope_type,
  scope_value: draft.scope_type === "everyone" ? null : draft.scope_value,
  topic: draft.topic,
  action: draft.action,
  except_person_ids: draft.scope_type === "person" ? [] : draft.except,
});

/**
 * Your reminder rules, each read back as one sentence, and a small builder:
 * who it applies to, what, what it does, and who's excepted.
 */
export function RuleEditor({
  open,
  onOpenChange,
  rules,
  people,
  pending,
  onCreate,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: Rule[];
  people: Person[];
  pending?: boolean;
  onCreate: (input: RuleInput) => void;
  onDelete: (rule: Rule) => void;
}) {
  const [draft, setDraft] = useState<Draft>(blank);
  useEffect(() => {
    if (open) setDraft(blank);
  }, [open]);
  const others = people.filter((person) => !person.is_me);

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const setScope = (scope_type: ScopeType) =>
    set({
      scope_type,
      except: [],
      scope_value:
        scope_type === "circle"
          ? "relatives"
          : scope_type === "relation"
            ? "cousin"
            : scope_type === "person"
              ? (others[0]?.id ?? "")
              : "",
    });

  const preview = toInput(draft);
  const previewRule: Rule = { ...preview, id: "preview" };
  // Exceptions are offered from the people the rule would cover.
  const wide = { ...previewRule, except_person_ids: [] };
  const covered = others.filter(
    (person) => ruleApplies(wide, person, "birthday") || ruleApplies(wide, person, "checkin"),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reminder rules</DialogTitle>
          <DialogDescription>
            Without a rule, you're reminded of birthdays and of the check-ins you set. The most
            specific rule wins: one person, then a relation, then a circle, then everyone.
          </DialogDescription>
        </DialogHeader>

        {rules.length ? (
          <ul className="space-y-2" aria-label="Your rules">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 text-sm"
              >
                <span>{describeRule(rule, people)}</span>
                <button
                  type="button"
                  aria-label={`Delete rule: ${describeRule(rule, people)}`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => onDelete(rule)}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No rules yet.</p>
        )}

        <form
          className="space-y-3 rounded-xl bg-secondary p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.scope_type !== "everyone" && !draft.scope_value) return;
            onCreate(preview);
            setDraft(blank);
          }}
        >
          <p className="text-sm font-medium">New rule</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rule-action">Does</Label>
              <select
                id="rule-action"
                className={selectClass}
                value={draft.action}
                onChange={(event) => set({ action: event.target.value as RuleAction })}
              >
                <option value="quiet">Don't remind me</option>
                <option value="remind">Remind me</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-topic">Of</Label>
              <select
                id="rule-topic"
                className={selectClass}
                value={draft.topic}
                onChange={(event) => set({ topic: event.target.value as RuleTopic })}
              >
                <option value="birthday">Birthdays</option>
                <option value="checkin">Check-ins</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-scope">For</Label>
              <select
                id="rule-scope"
                className={selectClass}
                value={draft.scope_type}
                onChange={(event) => setScope(event.target.value as ScopeType)}
              >
                {SCOPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            {draft.scope_type !== "everyone" ? (
              <div className="space-y-1.5">
                <Label htmlFor="rule-value">Which</Label>
                <select
                  id="rule-value"
                  className={selectClass}
                  value={draft.scope_value}
                  onChange={(event) => set({ scope_value: event.target.value, except: [] })}
                >
                  {(draft.scope_type === "circle"
                    ? CIRCLES.map((item) => ({ value: item.value, label: item.label }))
                    : draft.scope_type === "relation"
                      ? RELATIONS.map((item) => ({ value: item.value, label: item.label }))
                      : others.map((person) => ({ value: person.id, label: person.name }))
                  ).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {draft.scope_type !== "person" && covered.length ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Except</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {covered.map((person) => {
                  const checked = draft.except.includes(person.id);
                  return (
                    <label key={person.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          set({
                            except: value
                              ? [...draft.except, person.id]
                              : draft.except.filter((id) => id !== person.id),
                          })
                        }
                      />
                      {person.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <p className="rounded-lg bg-card p-2.5 text-sm" aria-live="polite">
            {describeRule(previewRule, people)}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Done
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add rule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
