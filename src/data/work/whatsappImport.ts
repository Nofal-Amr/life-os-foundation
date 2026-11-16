/**
 * A stopgap for past days: reads a WhatsApp chat export where people post
 * "in" and "out" (in English or Arabic), and turns it into clock-in and
 * clock-out times per person and day. An admin checks the result and saves it
 * as ordinary corrections, so the original records stay as they were.
 *
 * The chat text never leaves the browser. Only the times that are saved do.
 */

export type DateOrder = "dmy" | "mdy";

export type ChatMessage = {
  sender: string;
  /** The posted date, YYYY-MM-DD, as the phone wrote it. */
  day: string;
  /** The posted time, HH:MM, 24-hour. */
  time: string;
  text: string;
};

export type Punch = ChatMessage & {
  field: "in" | "out";
  /** The time it counts as: one written in the message, else the posted time. */
  at: string;
};

export type DayEntry = {
  sender: string;
  day: string;
  in: Punch | null;
  out: Punch | null;
};

const DIGITS: Record<string, string> = {};
"٠١٢٣٤٥٦٧٨٩".split("").forEach((digit, index) => (DIGITS[digit] = String(index)));
"۰۱۲۳۴۵۶۷۸۹".split("").forEach((digit, index) => (DIGITS[digit] = String(index)));

/** Western digits, plain spaces and commas, and no direction marks. */
export function normalizeLine(line: string): string {
  return line
    .replace(/[٠-٩۰-۹]/g, (digit) => DIGITS[digit] ?? digit)
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/،/g, ",");
}

const HEADER =
  /^\[?(\d{1,4})[/.-](\d{1,2})(?:[/.-](\d{1,4}))?,?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp]\.?\s?[Mm]\.?|ص|م)?\]?\s*(?:-\s*)?([^:]{1,80}?):\s?(.*)$/;

type RawMessage = {
  a: number;
  b: number;
  /** The year as written, or null when copied messages leave it out. */
  c: number | null;
  hour: number;
  minute: number;
  sender: string;
  text: string;
};

function to24(hour: number, marker: string | undefined): number {
  if (!marker) return hour;
  const pm = /^[Pp]|^م$/.test(marker);
  if (hour === 12) return pm ? 12 : 0;
  return pm ? hour + 12 : hour;
}

function readRaw(text: string): RawMessage[] {
  const out: RawMessage[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalizeLine(rawLine).trim();
    if (!line) continue;
    const match = HEADER.exec(line);
    if (!match) {
      // A message that runs over several lines: only its first line counts.
      continue;
    }
    const [, a, b, c, hour, minute, marker, sender, body] = match;
    out.push({
      a: Number(a),
      b: Number(b),
      c: c ? Number(c) : null,
      hour: to24(Number(hour), marker),
      minute: Number(minute),
      sender: sender!.trim(),
      text: body!.trim(),
    });
  }
  return out;
}

/** Day-month or month-day: decided by any date that only fits one way. */
export function guessDateOrder(text: string): DateOrder {
  const raw = readRaw(text).filter((item) => item.a < 100);
  if (raw.some((item) => item.a > 12)) return "dmy";
  if (raw.some((item) => item.b > 12)) return "mdy";
  return "dmy";
}

const pad = (value: number) => String(value).padStart(2, "0");

function isoDay(item: RawMessage, order: DateOrder, today: string): string | null {
  let year: number, month: number, day: number;
  if (item.a > 999) {
    if (item.c === null) return null;
    [year, month, day] = [item.a, item.b, item.c];
  } else {
    [day, month] = order === "dmy" ? [item.a, item.b] : [item.b, item.a];
    if (item.c !== null) year = item.c < 100 ? 2000 + item.c : item.c;
    else {
      // Copied messages carry no year: this year, or last year for a date still ahead.
      year = Number(today.slice(0, 4));
      if (`${year}-${pad(month)}-${pad(day)}` > today) year -= 1;
    }
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Today on this device, YYYY-MM-DD. */
const localToday = () => new Date().toLocaleDateString("en-CA");

/**
 * Every message with a sender, in the order of the chat. Reads exported chats
 * and messages copied straight from WhatsApp, which have no year.
 */
export function parseChat(
  text: string,
  order: DateOrder = guessDateOrder(text),
  today: string = localToday(),
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const item of readRaw(text)) {
    const day = isoDay(item, order, today);
    if (!day || item.hour > 23 || item.minute > 59) continue;
    messages.push({
      sender: item.sender,
      day,
      time: `${pad(item.hour)}:${pad(item.minute)}`,
      text: item.text,
    });
  }
  return messages;
}

/** Lower case, Arabic letters folded, no diacritics, punctuation or emoji. */
function fold(text: string): string {
  return normalizeLine(text)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}:\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const IN_PHRASES = [
  "check in",
  "checked in",
  "checking in",
  "checkin",
  "clocking in",
  "clock in",
  "clocked in",
  "sign in",
  "signed in",
  "arrived",
  "حضور",
  "حاضر",
  "دخول",
  "وصلت",
  "وصول",
  "وصلنا",
];
const OUT_PHRASES = [
  "check out",
  "checked out",
  "checking out",
  "checkout",
  "clocking out",
  "clock out",
  "clocked out",
  "sign out",
  "signed out",
  "انصراف",
  "انصرفت",
  "خروج",
  "مغادره",
  "غادرت",
  "مشيت",
  "روحت",
];

const TIME_IN_TEXT = /(?:^|\s)(\d{1,2}):(\d{2})(?:\s*(am|pm|ص|م)(?=\s|$))?/;

function has(folded: string, phrase: string): boolean {
  return ` ${folded} `.includes(` ${phrase} `);
}

/**
 * Whether a message is a clock-in or a clock-out. A bare "in" or "out" counts
 * only when it is the whole message (a time may follow), so a sentence such as
 * "in traffic" doesn't. A message that reads as both counts as neither.
 */
export function classify(text: string): "in" | "out" | null {
  const folded = fold(text);
  const withoutTime = folded.replace(TIME_IN_TEXT, " ").replace(/\s+/g, " ").trim();
  const isIn = withoutTime === "in" || IN_PHRASES.some((phrase) => has(folded, phrase));
  const isOut = withoutTime === "out" || OUT_PHRASES.some((phrase) => has(folded, phrase));
  if (isIn === isOut) return null;
  return isIn ? "in" : "out";
}

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/**
 * A time written in the message ("in 8:05"), for people who post later. With
 * no am or pm, the reading nearer to when it was posted wins, so "out 5:30"
 * posted at 17:40 is 17:30.
 */
export function timeInText(text: string, posted: string): string | null {
  const match = TIME_IN_TEXT.exec(fold(text));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const marker = match[3];
  if (marker) {
    if (hour < 1 || hour > 12) return null;
    return `${pad(to24(hour, marker === "pm" ? "p" : marker))}:${pad(minute)}`;
  }
  const candidates = hour >= 1 && hour <= 11 ? [hour, hour + 12] : [hour];
  const postedAt = minutes(posted);
  const best = candidates
    .map((value) => ({ value, gap: Math.abs(value * 60 + minute - postedAt) }))
    .sort((x, y) => x.gap - y.gap)[0]!.value;
  return `${pad(best)}:${pad(minute)}`;
}

export function punches(messages: ChatMessage[]): Punch[] {
  const out: Punch[] = [];
  for (const message of messages) {
    const field = classify(message.text);
    if (!field) continue;
    out.push({ ...message, field, at: timeInText(message.text, message.time) ?? message.time });
  }
  return out;
}

function previousDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * One row per person and day: the first clock-in and the last clock-out. An
 * early-morning clock-out with no clock-in that day closes the day before
 * when that day is still open, for shifts past midnight.
 */
export function dayEntries(list: Punch[]): DayEntry[] {
  const rows = new Map<string, DayEntry>();
  const row = (sender: string, day: string) => {
    const key = `${sender}\u0000${day}`;
    let entry = rows.get(key);
    if (!entry) {
      entry = { sender, day, in: null, out: null };
      rows.set(key, entry);
    }
    return entry;
  };
  const ordered = [...list].sort((x, y) =>
    `${x.day} ${x.time}`.localeCompare(`${y.day} ${y.time}`),
  );
  for (const punch of ordered) {
    if (punch.field === "in") {
      const entry = row(punch.sender, punch.day);
      if (!entry.in) entry.in = punch;
      continue;
    }
    const today = rows.get(`${punch.sender}\u0000${punch.day}`);
    const before = rows.get(`${punch.sender}\u0000${previousDay(punch.day)}`);
    const overnight =
      !today?.in && before?.in && !before.out && minutes(punch.at) < 12 * 60 ? before : null;
    const entry = overnight ?? row(punch.sender, punch.day);
    if (!entry.out || `${punch.day} ${punch.time}` >= `${entry.out.day} ${entry.out.time}`)
      entry.out = punch;
  }
  return [...rows.values()].sort(
    (x, y) => x.day.localeCompare(y.day) || x.sender.localeCompare(y.sender),
  );
}

/** The member a WhatsApp name most likely is, when only one fits. */
export function matchMember<T extends { display_name: string }>(
  sender: string,
  members: T[],
): T | null {
  const name = fold(sender);
  if (!name) return null;
  const exact = members.filter((member) => fold(member.display_name) === name);
  if (exact.length === 1) return exact[0]!;
  const first = name.split(" ")[0]!;
  const partial = members.filter((member) => {
    const other = fold(member.display_name);
    return other.split(" ")[0] === first || has(other, name) || has(name, other);
  });
  return partial.length === 1 ? partial[0]! : null;
}

/**
 * The message to post after clocking in or out, with the clock time in the
 * company's time zone, 24-hour: "In 08:31". Sent late, it still imports as
 * 08:31, because a time written in the message wins.
 */
export function clockMessage(kind: "in" | "out", at: string, timeZone: string): string {
  const time = new Date(at).toLocaleTimeString("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${kind === "in" ? "In" : "Out"} ${time}`;
}

/** Opens WhatsApp with the text typed in; the person picks the group and sends. */
export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** What the sheet keeps as the reason: where the time came from. */
export function reasonFor(punch: Punch): string {
  return `WhatsApp ${punch.day} ${punch.time}: ${punch.text}`.slice(0, 300);
}
