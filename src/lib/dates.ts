/**
 * date-fns `format`, in the reader's language: Arabic month and weekday names
 * when the app is in Arabic. Digits and machine patterns ("yyyy-MM-dd") come
 * out the same in both languages, so stored keys never change.
 */
import { format as formatEn } from "date-fns";
import { ar } from "date-fns/locale";

import { getLang } from "@/lib/i18n";

type Options = Parameters<typeof formatEn>[2];

export function format(date: Date | number | string, pattern: string, options?: Options): string {
  return formatEn(date, pattern, getLang() === "ar" ? { ...options, locale: ar } : options);
}
