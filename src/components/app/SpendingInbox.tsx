import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bell, Check, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { accountsQuery, createTransaction, financeKeys } from "@/data/finance";
import { usePreferences } from "@/hooks/usePreferences";
import { buildFeatures, lifeConnect, spendingInbox, type PendingSpend, type SpendingStatus } from "@/lib/native";
import { cn } from "@/lib/utils";

/** Per phone: which account spending from notifications goes to. */
const ACCOUNT_KEY = "spending:account";
const DEFAULT_SENDERS = "CIB, NBE, Banque Misr, QNB, InstaPay, Vodafone Cash, Fawry, Valu";

function readAccount(): string | null {
  try {
    return localStorage.getItem(ACCOUNT_KEY);
  } catch {
    return null;
  }
}

/** The transaction for a spend: money out, on the day it happened. */
async function logSpend(spend: PendingSpend, accountId: string, currency: string | null) {
  const foreign = currency && spend.currency && spend.currency !== currency;
  await createTransaction({
    account_id: accountId,
    category_id: null,
    amount: -Math.abs(spend.amount),
    kind: "expense",
    description:
      [
        spend.merchant || spend.source || "Card payment",
        foreign ? `${spend.amount} ${spend.currency}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    date: format(new Date(spend.at), "yyyy-MM-dd"),
    occurred_time: format(new Date(spend.at), "HH:mm"),
  });
}

/**
 * Writes spending you said "Log it" to on the notification into Money, when
 * the app opens. Mounted once in the app layout.
 */
export function useSpendingInbox() {
  const queryClient = useQueryClient();
  const accounts = useQuery({ ...accountsQuery(), enabled: spendingInbox.available() });
  const { currency: prefCurrency } = usePreferences();
  const currency = prefCurrency ?? null;

  useEffect(() => {
    if (!spendingInbox.available() || !accounts.data) return;
    const flush = async () => {
      const chosen = readAccount();
      const account =
        accounts.data.find((item) => item.id === chosen && item.active) ??
        accounts.data.find((item) => item.active && item.type !== "credit");
      if (!account) return;
      const yes = spendingInbox.pending().filter((spend) => spend.status === "log");
      let logged = 0;
      for (const spend of yes) {
        try {
          await logSpend(spend, account.id, currency);
          spendingInbox.resolve(spend.id, "done");
          logged += 1;
        } catch {
          // Try again next time.
        }
      }
      if (logged) {
        void queryClient.invalidateQueries({ queryKey: financeKeys.transactions });
        toast.success(
          logged === 1
            ? "1 spending logged from a notification."
            : `${logged} spendings logged from notifications.`,
        );
      }
    };
    void flush();
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [accounts.data, currency, queryClient]);
}

/** Money page: spending picked up but not answered yet. */
export function SpendingReview() {
  const queryClient = useQueryClient();
  const accounts = useQuery(accountsQuery());
  const { fmtMoney, currency } = usePreferences();
  const [items, setItems] = useState<PendingSpend[]>([]);
  const refresh = useCallback(
    () => setItems(spendingInbox.pending().filter((s) => s.status === "new")),
    [],
  );

  useEffect(() => {
    if (!spendingInbox.available()) return;
    refresh();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  if (!items.length) return null;

  async function answer(spend: PendingSpend, yes: boolean) {
    if (!yes) {
      spendingInbox.resolve(spend.id, "dismiss");
      refresh();
      return;
    }
    const chosen = readAccount();
    const account =
      (accounts.data ?? []).find((item) => item.id === chosen && item.active) ??
      (accounts.data ?? []).find((item) => item.active && item.type !== "credit");
    if (!account) {
      toast.error("Add an account in Money first.");
      return;
    }
    try {
      await logSpend(spend, account.id, currency ?? null);
      spendingInbox.resolve(spend.id, "done");
      void queryClient.invalidateQueries({ queryKey: financeKeys.transactions });
      toast.success("Logged.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't log it.");
    }
    refresh();
  }

  return (
    <section className="stat-card space-y-3 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Bell className="size-4" /> From your bank notifications
      </p>
      <ul className="space-y-2">
        {items.map((spend) => (
          <li key={spend.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium tabular-nums">
                {spend.currency === (currency ?? spend.currency)
                  ? fmtMoney(spend.amount)
                  : `${spend.amount} ${spend.currency}`}
              </span>
              {spend.merchant ? ` at ${spend.merchant}` : ""}
              <span className="block text-xs text-muted-foreground">
                {spend.source} · {format(new Date(spend.at), "d MMM, HH:mm")}
              </span>
            </span>
            <span className="flex gap-1">
              <Button size="sm" onClick={() => void answer(spend, true)}>
                <Check className="size-4" /> Log it
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void answer(spend, false)}>
                <X className="size-4" /> Not spending
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Settings: turn it on, pick the apps and SMS senders, and the account. */
export function SpendingSettingsCard() {
  const accounts = useQuery(accountsQuery());
  const [status, setStatus] = useState<SpendingStatus | null>(null);
  const [senders, setSenders] = useState(DEFAULT_SENDERS);
  const [account, setAccount] = useState<string>("auto");

  useEffect(() => {
    if (!spendingInbox.available()) return;
    const refresh = () => {
      const next = spendingInbox.status();
      setStatus(next);
      if (next?.watch.senders.length) setSenders(next.watch.senders.join(", "));
    };
    refresh();
    setAccount(readAccount() ?? "auto");
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  if (!spendingInbox.available()) return null;
  if (!buildFeatures().spending) {
    return (
      <section className="stat-card space-y-2 p-5">
        <p className="flex items-center gap-2 text-base font-semibold">
          <Bell className="size-4" /> Spending from bank notifications
        </p>
        <p className="text-sm text-muted-foreground">
          This needs Life OS Full. Google blocks notification access for apps installed from
          WhatsApp or a browser, so the Full version is installed from a computer.
        </p>
      </section>
    );
  }

  const watched = new Set(status?.watch.packages ?? []);
  const seen = Object.entries(status?.seen ?? {}).sort((a, b) => a[1].localeCompare(b[1]));
  const forwards = lifeConnect.status()?.role === "sim";

  function save(packages: Set<string>, senderText = senders) {
    const watch = {
      packages: [...packages],
      senders: senderText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    };
    spendingInbox.setWatch(watch);
    setStatus((current) => (current ? { ...current, watch } : current));
  }

  return (
    <section className="stat-card space-y-4 p-5">
      <div>
        <p className="flex items-center gap-2 text-base font-semibold">
          <Bell className="size-4" /> Spending from bank notifications
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          When a bank or wallet app (or a bank SMS) says you paid, you get "Spent 250 EGP at
          Carrefour? Log it". Nothing is logged without your yes.
          {forwards
            ? " This phone is your Life Connect SIM phone, so the question goes to your main phone."
            : ""}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "grid size-5 place-items-center rounded-full",
              status?.access ? "bg-primary/20" : "bg-secondary",
            )}
            aria-hidden="true"
          >
            {status?.access ? <Check className="size-3.5" /> : null}
          </span>
          Notification access
        </span>
        {!status?.access ? (
          <Button size="sm" variant="outline" onClick={() => spendingInbox.openAccess()}>
            Allow
          </Button>
        ) : null}
      </div>

      {status?.access ? (
        <div className="space-y-2">
          <Label>Apps to watch</Label>
          {seen.length ? (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {seen.map(([pkg, name]) => (
                <li key={pkg}>
                  <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={watched.has(pkg)}
                      onChange={(event) => {
                        const next = new Set(watched);
                        if (event.target.checked) next.add(pkg);
                        else next.delete(pkg);
                        save(next);
                      }}
                    />
                    {name}
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Apps show up here once they've sent a notification. Come back after your bank app or
              an SMS has.
            </p>
          )}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="spending-senders">SMS senders that are banks</Label>
        <Input
          id="spending-senders"
          className="h-11"
          value={senders}
          onChange={(event) => setSenders(event.target.value)}
          onBlur={() => save(watched)}
        />
        <p className="text-xs text-muted-foreground">
          For your Messages app: only SMS from these names are read. Tick Messages above too.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Log to</Label>
        <Select
          value={account}
          onValueChange={(value) => {
            setAccount(value);
            try {
              if (value === "auto") localStorage.removeItem(ACCOUNT_KEY);
              else localStorage.setItem(ACCOUNT_KEY, value);
            } catch {
              // Not remembered.
            }
          }}
        >
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">My first account</SelectItem>
            {(accounts.data ?? [])
              .filter((item) => item.active)
              .map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <p className="flex gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Read on this phone only. Messages with a one-time code, password or verification are dropped
        unread, money coming in is ignored, and only the amount, shop and app name are kept — never
        the message.
      </p>
    </section>
  );
}
