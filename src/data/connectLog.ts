/**
 * Grouping Life Connect's log (SMS in, replies out, calls) for the Messages
 * page. The log itself lives on the phone; this only arranges it.
 */
import type { ConnectLogEntry } from "@/lib/native";

export type Conversation = {
  /** The other side's number (what replies go to). */
  number: string;
  /** Their contact name if the SIM phone knew it, else the number. */
  name: string;
  last: ConnectLogEntry;
  count: number;
};

/**
 * One sender, however it was written: spaces, dashes and brackets don't count
 * ("+20 100 123 4567" is "+201001234567"); named senders like "VODAFONE" or
 * a bank stay as they are.
 */
function key(number: string | undefined): string {
  return (number ?? "").replace(/[\s()-]/g, "").toLowerCase();
}

/** One row per person, newest conversation first. */
export function conversations(entries: ConnectLogEntry[]): Conversation[] {
  const byNumber = new Map<string, Conversation>();
  for (const entry of entries) {
    if (entry.kind === "call") continue;
    const id = key(entry.number);
    if (!id) continue;
    const current = byNumber.get(id);
    const name = entry.name || current?.name || entry.number || id;
    if (!current || entry.at >= current.last.at) {
      byNumber.set(id, {
        number: entry.number ?? id,
        name,
        last: entry,
        count: (current?.count ?? 0) + 1,
      });
    } else {
      current.count += 1;
      if (!current.name || current.name === current.number) current.name = name;
    }
  }
  return [...byNumber.values()].sort((a, b) => b.last.at - a.last.at);
}

/** Everything said with one person, oldest first. */
export function thread(entries: ConnectLogEntry[], number: string): ConnectLogEntry[] {
  const id = key(number);
  return entries
    .filter((entry) => entry.kind !== "call" && key(entry.number) === id)
    .sort((a, b) => a.at - b.at);
}

/** Calls, newest first. */
export function calls(entries: ConnectLogEntry[]): ConnectLogEntry[] {
  return entries.filter((entry) => entry.kind === "call").sort((a, b) => b.at - a.at);
}
