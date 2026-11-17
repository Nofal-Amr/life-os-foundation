import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  addCorrections,
  type CorrectionInput,
  type WorkMember,
  type WorkOrg,
} from "@/data/work/api";
import type { WorkRules } from "@/data/work/rules";
import { zonedIso } from "@/data/work/time";
import {
  dayEntries,
  guessDateOrder,
  matchMember,
  parseChat,
  punches,
  reasonFor,
  type DateOrder,
  type DayEntry,
} from "@/data/work/whatsappImport";
import { t } from "@/lib/i18n";
import { toError } from "@/lib/supabase-helpers";

const keyOf = (entry: DayEntry) => `${entry.sender}\u0000${entry.day}`;
const SKIP = "";

/**
 * For past days kept in a WhatsApp group: paste the exported chat, match each
 * sender to a person, check the days, and save them as corrections.
 */
export function WhatsAppImport({
  open,
  onOpenChange,
  org,
  rules,
  members,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  org: WorkOrg;
  rules: WorkRules;
  members: WorkMember[];
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [order, setOrder] = useState<DateOrder | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [left, setLeft] = useState<Set<string>>(new Set());

  const dateOrder = order ?? guessDateOrder(text);
  const messages = useMemo(() => parseChat(text, dateOrder), [text, dateOrder]);
  const found = useMemo(() => punches(messages), [messages]);
  const entries = useMemo(() => dayEntries(found), [found]);
  const senders = useMemo(() => [...new Set(entries.map((entry) => entry.sender))], [entries]);
  const memberFor = (sender: string): string =>
    chosen[sender] ?? matchMember(sender, members)?.user_id ?? SKIP;
  const nameOf = (userId: string) =>
    members.find((member) => member.user_id === userId)?.display_name ?? "";

  const inputs: CorrectionInput[] = [];
  for (const entry of entries) {
    const userId = memberFor(entry.sender);
    if (!userId || left.has(keyOf(entry))) continue;
    for (const punch of [entry.in, entry.out]) {
      if (!punch) continue;
      inputs.push({
        org_id: org.id,
        user_id: userId,
        day: entry.day,
        field: punch.field,
        value: zonedIso(punch.day, punch.at, rules.timezone),
        reason: reasonFor(punch),
      });
    }
  }

  const reset = () => {
    setText("");
    setOrder(null);
    setChosen({});
    setLeft(new Set());
  };
  const save = useMutation({
    mutationFn: () => addCorrections(inputs),
    onSuccess: () => {
      toast.success(`${t("Saved")}: ${inputs.length}`);
      reset();
      onSaved();
      onOpenChange(false);
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setText(await file.text());
    setOrder(null);
    setLeft(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("From WhatsApp")}</DialogTitle>
          <DialogDescription>
            {t(
              "For past days. In WhatsApp, select the messages and copy them, or export the chat (More, Export chat, Without media). Paste the text or pick the file. It stays on this device; only the times you save are sent.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            type="file"
            accept=".txt,text/plain"
            aria-label={t("Chat file")}
            className="block w-full text-sm"
            onChange={(event) => void readFile(event.target.files?.[0])}
          />
          <Textarea
            value={text}
            rows={5}
            aria-label={t("Chat text")}
            placeholder="[11/16, 8:03 AM] Ahmed: In"
            onChange={(event) => {
              setText(event.target.value);
              setLeft(new Set());
            }}
          />

          {text.trim() ? (
            <p className="text-sm text-muted-foreground">
              {`${messages.length} ${t("messages")} · ${found.length} ${t("clock-ins and clock-outs")} · ${messages.length - found.length} ${t("other messages skipped")}`}
            </p>
          ) : null}

          {messages.length ? (
            <label className="flex items-center justify-between gap-2 text-sm">
              <span>{t("Dates are written")}</span>
              <select
                className="h-10 rounded-lg border border-border bg-card px-2 text-sm"
                value={dateOrder}
                onChange={(event) => setOrder(event.target.value as DateOrder)}
              >
                <option value="dmy">{t("Day first (16/11)")}</option>
                <option value="mdy">{t("Month first (11/16)")}</option>
              </select>
            </label>
          ) : null}

          {senders.length ? (
            <section className="space-y-2">
              <p className="text-sm font-semibold">{t("Who is who")}</p>
              {senders.map((sender) => (
                <label key={sender} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate" dir="auto">
                    {sender}
                  </span>
                  <select
                    className="h-10 max-w-[55%] rounded-lg border border-border bg-card px-2 text-sm"
                    value={memberFor(sender)}
                    onChange={(event) =>
                      setChosen((current) => ({ ...current, [sender]: event.target.value }))
                    }
                  >
                    <option value={SKIP}>{t("Skip")}</option>
                    {members.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.display_name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <p className="text-xs text-muted-foreground">
                {t("Only people who have joined the company can be matched.")}
              </p>
            </section>
          ) : null}

          {entries.length ? (
            <section className="space-y-1">
              <p className="text-sm font-semibold">{t("Days")}</p>
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {entries.map((entry) => {
                  const userId = memberFor(entry.sender);
                  const key = keyOf(entry);
                  return (
                    <li key={key}>
                      <label className="flex min-h-10 items-center gap-3 text-sm">
                        <Checkbox
                          disabled={!userId}
                          checked={!!userId && !left.has(key)}
                          onCheckedChange={(checked) =>
                            setLeft((current) => {
                              const next = new Set(current);
                              if (checked) next.delete(key);
                              else next.add(key);
                              return next;
                            })
                          }
                        />
                        <span className="tabular-nums">{entry.day}</span>
                        <span className="min-w-0 flex-1 truncate" dir="auto">
                          {userId ? nameOf(userId) : entry.sender}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {`${entry.in?.at ?? "–"} → ${entry.out?.at ?? "–"}`}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Each time is saved as a correction for that day. The original records stay as they were.",
                )}
              </p>
            </section>
          ) : null}

          <Button
            type="button"
            className="w-full"
            disabled={!inputs.length || save.isPending}
            onClick={() => save.mutate()}
          >
            {`${t("Save")} ${inputs.length ? `(${inputs.length})` : ""}`.trim()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
