import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, CornerDownLeft, Loader2, Mic, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseCapture, type Capture } from "@/data/capture";
import { accountsQuery, createTransaction, financeKeys } from "@/data/finance";
import { createTask, deleteTask, taskKeys } from "@/data/tasks";
import { usePreferences } from "@/hooks/usePreferences";
import { canListen, listen } from "@/lib/native";
import { todayISO } from "@/lib/date";
import { toError } from "@/lib/supabase-helpers";

/**
 * Type it how you'd say it: "120 lunch" logs spending, "+500 bonus" income,
 * anything else becomes a task ("call mom tomorrow" is due tomorrow). The line
 * under the box says what Enter will save.
 */
export function CaptureBox({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const accounts = useQuery(accountsQuery());
  const { fmtMoney, fmtDate } = usePreferences();
  const [text, setText] = useState("");
  const [hearing, setHearing] = useState(false);
  const voice = canListen();
  const capture = parseCapture(text);
  const account = (accounts.data ?? []).find((item) => item.active && item.type !== "credit");

  const save = useMutation({
    mutationFn: async (value: Capture) => {
      if (value.kind === "task") {
        const task = await createTask({
          title: value.title,
          description: null,
          status: "inbox",
          priority: "medium",
          due_date: value.due,
          project_id: null,
          capability_id: null,
          goal_id: null,
        });
        return { kind: "task" as const, id: (task as unknown as { id: string }).id };
      }
      if (!account) throw new Error("Add an account in Money first.");
      await createTransaction({
        account_id: account.id,
        category_id: null,
        amount: value.kind === "income" ? Math.abs(value.amount) : -Math.abs(value.amount),
        kind: value.kind === "income" ? "income" : "expense",
        description: value.note || null,
        date: todayISO(),
      });
      return { kind: value.kind, id: null };
    },
    onSuccess: (result) => {
      setText("");
      if (result.kind === "task") {
        void queryClient.invalidateQueries({ queryKey: taskKeys.all });
        toast.success("Task added.", {
          action: {
            label: "Undo",
            onClick: () =>
              void deleteTask(result.id!).then(() =>
                queryClient.invalidateQueries({ queryKey: taskKeys.all }),
              ),
          },
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: financeKeys.transactions });
        toast.success(result.kind === "income" ? "Income logged." : "Spending logged.");
      }
      onDone();
    },
    onError: (error) => toast.error(toError(error).message),
  });

  const preview =
    capture == null
      ? null
      : capture.kind === "task"
        ? {
            icon: CheckSquare,
            text: `Task: ${capture.title}${capture.due ? ` · due ${fmtDate(capture.due)}` : ""}`,
          }
        : capture.kind === "income"
          ? {
              icon: TrendingUp,
              text: `Income ${fmtMoney(capture.amount)}${capture.note ? ` · ${capture.note}` : ""}`,
            }
          : {
              icon: TrendingDown,
              text: `Spending ${fmtMoney(capture.amount)}${capture.note ? ` · ${capture.note}` : ""}${account ? ` · from ${account.name}` : ""}`,
            };

  return (
    <form
      className="mb-4 space-y-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (capture && !save.isPending) save.mutate(capture);
      }}
    >
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="120 lunch · call mom tomorrow · +500 bonus"
          aria-label="Quick capture"
          dir="auto"
          enterKeyHint="done"
          className="h-12 flex-1 text-base"
        />
        {voice ? (
          <Button
            type="button"
            variant="outline"
            className="h-12 w-12 shrink-0"
            aria-label="Say it"
            disabled={hearing}
            onClick={async () => {
              setHearing(true);
              try {
                const said = await listen();
                if (said) setText(said);
              } catch {
                toast.error("Voice input isn't available here.");
              } finally {
                setHearing(false);
              }
            }}
          >
            {hearing ? <Loader2 className="size-5 animate-spin" /> : <Mic className="size-5" />}
          </Button>
        ) : null}
      </div>
      <p
        className="flex min-h-5 items-center gap-1.5 px-1 text-xs text-muted-foreground"
        aria-live="polite"
      >
        {preview ? (
          <>
            <preview.icon className="size-3.5" aria-hidden="true" />
            <span className="truncate">{preview.text}</span>
            <CornerDownLeft className="ms-auto size-3.5 shrink-0" aria-hidden="true" />
          </>
        ) : (
          "Type it how you'd say it, then Enter."
        )}
      </p>
    </form>
  );
}
