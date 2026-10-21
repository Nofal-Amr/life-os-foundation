import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, PhoneIncoming, PhoneMissed, PhoneOff, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { calls, conversations, thread } from "@/data/connectLog";
import { t } from "@/lib/i18n";
import { connectLog, type ConnectLogEntry } from "@/lib/native";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages · Life OS" },
      { name: "description", content: "SMS and calls from your SIM phone, kept on this phone." },
    ],
  }),
  component: MessagesPage,
});

/** Re-read the phone's log now and then, and when the app comes back to the front. */
function useLog() {
  const [entries, setEntries] = useState<ConnectLogEntry[]>(() => connectLog.read());
  const refresh = useCallback(() => setEntries(connectLog.read()), []);
  useEffect(() => {
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refresh]);
  return { entries, refresh };
}

function when(at: number) {
  const date = new Date(at);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { day: "numeric", month: "short" }) +
        " " +
        date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function MessagesPage() {
  const { entries, refresh } = useLog();
  const [tab, setTab] = useState<"messages" | "calls">("messages");
  const [open, setOpen] = useState<{ number: string; name: string } | null>(null);
  const [clearing, setClearing] = useState(false);

  if (!connectLog.available()) {
    return (
      <>
        <PageHeader title="Messages" />
        <EmptyState
          title="Messages from your SIM phone show here"
          description="Open Life OS on your main phone with Life Connect set to “Rings here”. SMS and calls are kept on that phone only."
        />
      </>
    );
  }

  if (open) {
    return <Thread person={open} entries={entries} onBack={() => setOpen(null)} onSent={refresh} />;
  }

  const people = conversations(entries);
  const callList = calls(entries);

  return (
    <>
      <PageHeader
        title="Messages"
        description="SMS and calls from your SIM phone, kept on this phone only."
        actions={
          entries.length ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setClearing(true)}>
              Clear
            </Button>
          ) : null
        }
      />

      <div className="mb-4 inline-flex gap-1 rounded-xl bg-secondary p-1" role="tablist">
        {(
          [
            { value: "messages", label: "Messages" },
            { value: "calls", label: "Calls" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={tab === option.value}
            onClick={() => setTab(option.value)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              tab === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {t(option.label)}
          </button>
        ))}
      </div>

      {tab === "messages" ? (
        people.length ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {people.map((person) => (
              <li key={person.number}>
                <button
                  type="button"
                  className="flex w-full items-baseline gap-3 px-4 py-3 text-start hover:bg-accent"
                  onClick={() => setOpen({ number: person.number, name: person.name })}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{person.name}</span>
                    <span className="block truncate text-sm text-muted-foreground" dir="auto">
                      {person.last.kind === "sent" ? `${t("You")}: ` : ""}
                      {person.last.body}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {when(person.last.at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No messages yet"
            description="SMS your SIM phone gets show here once Life Connect passes them on."
          />
        )
      ) : callList.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {callList.map((call) => {
            const Icon =
              call.outcome === "missed"
                ? PhoneMissed
                : call.outcome === "answered"
                  ? PhoneIncoming
                  : PhoneOff;
            const label =
              call.outcome === "missed"
                ? "Missed"
                : call.outcome === "answered"
                  ? "Answered"
                  : call.outcome === "ringing"
                    ? "Ringing"
                    : "Not answered";
            return (
              <li key={`${call.call}-${call.at}`} className="flex items-center gap-3 px-4 py-3">
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    call.outcome === "missed" ? "text-destructive" : "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {call.name || call.number || t("Unknown number")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(label)}
                    {call.name && call.number ? ` · ${call.number}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {when(call.at)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No calls yet" description="Calls to your SIM phone show here." />
      )}

      <ConfirmDialog
        open={clearing}
        onOpenChange={setClearing}
        title="Clear the messages and calls?"
        description="This removes them from this phone. The SIM phone keeps its own SMS."
        confirmLabel="Clear"
        onConfirm={() => {
          connectLog.clear();
          refresh();
          setClearing(false);
        }}
      />
    </>
  );
}

function Thread({
  person,
  entries,
  onBack,
  onSent,
}: {
  person: { number: string; name: string };
  entries: ConnectLogEntry[];
  onBack: () => void;
  onSent: () => void;
}) {
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement | null>(null);
  const messages = thread(entries, person.number);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    if (!connectLog.reply(person.number, person.name, body)) {
      toast.error(t("Couldn't send. Is Life Connect on?"));
      return;
    }
    setText("");
    // The reply shows once the SIM phone has it.
    window.setTimeout(onSent, 2500);
    window.setTimeout(onSent, 8000);
  };

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="mb-4 flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label={t("Back")} onClick={onBack}>
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{person.name}</p>
          {person.name !== person.number ? (
            <p className="text-xs text-muted-foreground">{person.number}</p>
          ) : null}
        </div>
      </div>

      <ol className="flex-1 space-y-2">
        {messages.map((message, index) => {
          const mine = message.kind === "sent";
          return (
            <li
              key={`${message.at}-${index}`}
              className={cn("flex", mine ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                  mine ? "bg-primary/15 text-foreground" : "bg-card ring-1 ring-border",
                )}
              >
                <p className="whitespace-pre-wrap break-words" dir="auto">
                  {message.body}
                </p>
                <p className="mt-1 text-2xs tabular-nums text-muted-foreground">
                  {when(message.at)}
                  {mine && message.ok === false ? ` · ${t("not sent")}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={bottom} />

      <form
        className="sticky bottom-0 mt-4 flex items-end gap-2 bg-background py-2"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("Reply from your SIM phone")}
          rows={1}
          maxLength={1600}
          dir="auto"
          className="min-h-11 flex-1 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          className="size-11"
          aria-label={t("Send")}
          disabled={!text.trim()}
        >
          <Send className="size-4 rtl:-scale-x-100" />
        </Button>
      </form>
    </div>
  );
}
