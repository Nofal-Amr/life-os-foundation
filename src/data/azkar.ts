/**
 * Morning and evening azkar (from Hisn al-Muslim), the tasbih counter's
 * phrases, and the plain record of what was read (dhikr_logs).
 *
 * Texts are written without tashkeel on purpose: every word here is checked
 * against the standard printing, and unvocalised text can't carry a wrong
 * vowel. Counts are the ones the hadith give.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type DhikrLog = Database["public"]["Tables"]["dhikr_logs"]["Row"];
export type AzkarTime = "morning" | "evening";

export type Zikr = {
  id: string;
  /** Short name shown above the text. */
  title: string;
  /** The text for the morning, and for the evening when it differs. */
  morning?: string;
  evening?: string;
  /** Said at both times, same words. */
  text?: string;
  count: number;
};

const AYAT_AL_KURSI =
  "الله لا إله إلا هو الحي القيوم لا تأخذه سنة ولا نوم له ما في السماوات وما في الأرض من ذا الذي يشفع عنده إلا بإذنه يعلم ما بين أيديهم وما خلفهم ولا يحيطون بشيء من علمه إلا بما شاء وسع كرسيه السماوات والأرض ولا يؤوده حفظهما وهو العلي العظيم";

export const AZKAR: Zikr[] = [
  { id: "kursi", title: "Ayat al-Kursi", text: AYAT_AL_KURSI, count: 1 },
  {
    id: "ikhlas",
    title: "Al-Ikhlas",
    text: "بسم الله الرحمن الرحيم ۝ قل هو الله أحد ۝ الله الصمد ۝ لم يلد ولم يولد ۝ ولم يكن له كفوا أحد",
    count: 3,
  },
  {
    id: "falaq",
    title: "Al-Falaq",
    text: "بسم الله الرحمن الرحيم ۝ قل أعوذ برب الفلق ۝ من شر ما خلق ۝ ومن شر غاسق إذا وقب ۝ ومن شر النفاثات في العقد ۝ ومن شر حاسد إذا حسد",
    count: 3,
  },
  {
    id: "nas",
    title: "An-Nas",
    text: "بسم الله الرحمن الرحيم ۝ قل أعوذ برب الناس ۝ ملك الناس ۝ إله الناس ۝ من شر الوسواس الخناس ۝ الذي يوسوس في صدور الناس ۝ من الجنة والناس",
    count: 3,
  },
  {
    id: "mulk",
    title: "The dominion is Allah's",
    morning:
      "أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير، رب أسألك خير ما في هذا اليوم وخير ما بعده، وأعوذ بك من شر ما في هذا اليوم وشر ما بعده، رب أعوذ بك من الكسل وسوء الكبر، رب أعوذ بك من عذاب في النار وعذاب في القبر",
    evening:
      "أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير، رب أسألك خير ما في هذه الليلة وخير ما بعدها، وأعوذ بك من شر ما في هذه الليلة وشر ما بعدها، رب أعوذ بك من الكسل وسوء الكبر، رب أعوذ بك من عذاب في النار وعذاب في القبر",
    count: 1,
  },
  {
    id: "bika",
    title: "By You we live",
    morning: "اللهم بك أصبحنا، وبك أمسينا، وبك نحيا، وبك نموت، وإليك النشور",
    evening: "اللهم بك أمسينا، وبك أصبحنا، وبك نحيا، وبك نموت، وإليك المصير",
    count: 1,
  },
  {
    id: "sayyid",
    title: "Sayyid al-Istighfar",
    text: "اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك، وأنا على عهدك ووعدك ما استطعت، أعوذ بك من شر ما صنعت، أبوء لك بنعمتك علي، وأبوء بذنبي فاغفر لي فإنه لا يغفر الذنوب إلا أنت",
    count: 1,
  },
  {
    id: "afini",
    title: "Wellbeing",
    text: "اللهم عافني في بدني، اللهم عافني في سمعي، اللهم عافني في بصري، لا إله إلا أنت. اللهم إني أعوذ بك من الكفر والفقر، وأعوذ بك من عذاب القبر، لا إله إلا أنت",
    count: 3,
  },
  {
    id: "alim",
    title: "Knower of the unseen",
    text: "اللهم عالم الغيب والشهادة فاطر السماوات والأرض، رب كل شيء ومليكه، أشهد أن لا إله إلا أنت، أعوذ بك من شر نفسي، ومن شر الشيطان وشركه، وأن أقترف على نفسي سوءا أو أجره إلى مسلم",
    count: 1,
  },
  {
    id: "bismillah",
    title: "In the name of Allah",
    text: "بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم",
    count: 3,
  },
  {
    id: "radeetu",
    title: "Content with Allah",
    text: "رضيت بالله ربا، وبالإسلام دينا، وبمحمد صلى الله عليه وسلم نبيا",
    count: 3,
  },
  {
    id: "hasbi",
    title: "Allah is enough for me",
    text: "حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم",
    count: 7,
  },
  {
    id: "hayy",
    title: "O Ever-Living",
    text: "يا حي يا قيوم برحمتك أستغيث، أصلح لي شأني كله، ولا تكلني إلى نفسي طرفة عين",
    count: 1,
  },
  {
    id: "fitra",
    title: "Upon the fitrah",
    morning:
      "أصبحنا على فطرة الإسلام، وعلى كلمة الإخلاص، وعلى دين نبينا محمد صلى الله عليه وسلم، وعلى ملة أبينا إبراهيم حنيفا مسلما وما كان من المشركين",
    evening:
      "أمسينا على فطرة الإسلام، وعلى كلمة الإخلاص، وعلى دين نبينا محمد صلى الله عليه وسلم، وعلى ملة أبينا إبراهيم حنيفا مسلما وما كان من المشركين",
    count: 1,
  },
  {
    id: "ilman",
    title: "Beneficial knowledge",
    morning: "اللهم إني أسألك علما نافعا، ورزقا طيبا، وعملا متقبلا",
    count: 1,
  },
  {
    id: "kalimat",
    title: "Perfect words of Allah",
    evening: "أعوذ بكلمات الله التامات من شر ما خلق",
    count: 3,
  },
  {
    id: "adada",
    title: "As many as His creation",
    morning: "سبحان الله وبحمده عدد خلقه ورضا نفسه وزنة عرشه ومداد كلماته",
    count: 3,
  },
  {
    id: "tahlil",
    title: "La ilaha illallah",
    text: "لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير",
    count: 10,
  },
  { id: "subhan", title: "SubhanAllah wa bihamdih", text: "سبحان الله وبحمده", count: 100 },
  {
    id: "salawat",
    title: "Salawat",
    text: "اللهم صل وسلم على نبينا محمد",
    count: 10,
  },
];

/** The azkar for one time of day, with that time's wording. */
export function azkarFor(time: AzkarTime): { zikr: Zikr; text: string }[] {
  return AZKAR.flatMap((zikr) => {
    const text = zikr.text ?? (time === "morning" ? zikr.morning : zikr.evening);
    return text ? [{ zikr, text }] : [];
  });
}

/** Phrases for the tasbih counter. */
export const TASBIH_PHRASES = [
  "سبحان الله",
  "الحمد لله",
  "الله أكبر",
  "لا إله إلا الله",
  "أستغفر الله",
  "سبحان الله وبحمده",
  "لا حول ولا قوة إلا بالله",
  "اللهم صل وسلم على نبينا محمد",
] as const;

export const TASBIH_TARGETS = [33, 99, 100, 1000] as const;

/* --------------------------------------------------------------- record */

export const dhikrKeys = { logs: ["dhikr_logs"] as const };

export const dhikrLogsQuery = () =>
  queryOptions({
    queryKey: dhikrKeys.logs,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("dhikr_logs")
          .select("*")
          .order("log_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(500),
      ) as DhikrLog[],
  });

export async function logDhikr(input: {
  log_date: string;
  kind: AzkarTime | "tasbih";
  count: number;
  label?: string | null;
}): Promise<DhikrLog> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("dhikr_logs")
      .insert({ ...input, label: input.label ?? null, user_id })
      .select()
      .single(),
  ) as DhikrLog;
}

export async function deleteDhikrLog(id: string): Promise<void> {
  unwrap(await supabase.from("dhikr_logs").delete().eq("id", id).select());
}

/** Whether that time's azkar were finished on a date. */
export function azkarDone(logs: DhikrLog[], date: string, time: AzkarTime): boolean {
  return logs.some((log) => log.log_date === date && log.kind === time);
}

/** Tasbih counted on a date, all sessions together. */
export function tasbihOn(logs: DhikrLog[], date: string): number {
  return logs
    .filter((log) => log.log_date === date && log.kind === "tasbih")
    .reduce((sum, log) => sum + log.count, 0);
}

/**
 * Which azkar fit the hour: morning from Fajr until Dhuhr, evening the rest
 * of the day (from Asr; between Dhuhr and Asr, the evening ones are next).
 */
export function azkarTimeAt(now: Date, times: { fajr: Date; dhuhr: Date } | null): AzkarTime {
  if (!times) return now.getHours() >= 4 && now.getHours() < 12 ? "morning" : "evening";
  return now >= times.fajr && now < times.dhuhr ? "morning" : "evening";
}
