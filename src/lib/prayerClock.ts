/**
 * The small clock at the top of Spirit: which prayer is next, how long until
 * it, and today's Hijri date. Pure functions, so they test without a clock.
 */
import type { PrayerName } from "@/data/spirit";

const ORDER: readonly PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

/**
 * The next of the five after `now`. After Isha it is tomorrow's Fajr, so the
 * line never goes blank at night.
 */
export function nextPrayerAt(
  now: Date,
  times: Record<PrayerName, Date>,
  tomorrowFajr: Date,
): { name: PrayerName; at: Date; tomorrow: boolean } {
  for (const name of ORDER) {
    if (times[name] > now) return { name, at: times[name], tomorrow: false };
  }
  return { name: "fajr", at: tomorrowFajr, tomorrow: true };
}

const arabicDigits = (text: string) => text.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);

/**
 * "1 h 20 min", "2 h", "13 min" (Arabic: "١ س ٢٠ د"). Rounded up; never less
 * than a minute.
 */
export function timeLeft(ms: number, lang: "en" | "ar" = "en"): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const [h, m] = lang === "ar" ? ["س", "د"] : ["h", "min"];
  const text = !hours ? `${rest} ${m}` : rest ? `${hours} ${h} ${rest} ${m}` : `${hours} ${h}`;
  return lang === "ar" ? arabicDigits(text) : text;
}

const formats: Partial<Record<"en" | "ar", Intl.DateTimeFormat>> = {};

/** The Umm al-Qura Hijri date: "1 Ramadan 1447 AH", or in Arabic "١ رمضان ١٤٤٧ هـ". */
export function hijriDate(date: Date, lang: "en" | "ar"): string {
  formats[lang] ??= new Intl.DateTimeFormat(
    lang === "ar" ? "ar-u-ca-islamic-umalqura-nu-arab" : "en-GB-u-ca-islamic-umalqura-nu-latn",
    { day: "numeric", month: "long", year: "numeric" },
  );
  return formats[lang]!.format(date);
}
