/**
 * The daily log: one line per kind of thing actually logged on a day. Nothing
 * is scored or judged — it is a receipt of the day, built from stored rows.
 */
import { format } from "date-fns";

export type DayInputs = {
  date: string;
  tasks: { status: string; completed_at: string | null }[];
  transactions: {
    kind: string;
    date: string;
    amount: number | string;
    description: string | null;
    category_id: string | null;
  }[];
  categories: { id: string; name: string }[];
  /** Calories are stored per entry, already multiplied by servings. */
  foodLogs: { log_date: string; calories: number }[];
  medications: { id: string; name: string }[];
  medicationLogs: { log_date: string; medication_id: string; taken: boolean }[];
  resources: { id: string; name: string; unit?: string | null }[];
  readings: { resource_id: string; reading: number; reading_at: string }[];
  sleepMinutes: number | null;
  prayersLogged: number;
  habitsTicked: number;
  minutesTracked: number;
};

export type DayLine = { key: string; text: string; detail?: string };

export type Formatters = {
  money: (value: number) => string;
  duration: (minutes: number) => string;
};

/** "A, B and 2 more" — names in the order logged, without repeats. */
export function listNames(names: string[], max = 3): string {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (unique.length <= max) return unique.join(", ");
  return `${unique.slice(0, max).join(", ")} and ${unique.length - max} more`;
}

/** The local calendar day of a timestamp. */
function localDay(timestamp: string): string {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? timestamp.slice(0, 10) : format(parsed, "yyyy-MM-dd");
}

export function dayLines(input: DayInputs, fmt: Formatters): DayLine[] {
  const { date } = input;
  const lines: DayLine[] = [];

  const done = input.tasks.filter(
    (task) => task.status === "completed" && (task.completed_at ?? "").slice(0, 10) === date,
  ).length;
  if (done)
    lines.push({ key: "tasks", text: `${done} ${done === 1 ? "task" : "tasks"} completed` });

  const categoryName = new Map(input.categories.map((row) => [row.id, row.name]));
  const today = input.transactions.filter((row) => row.date === date);
  const spending = today.filter((row) => row.kind === "expense");
  // Amounts are signed (money out is negative); the log shows sizes.
  const spent = spending.reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);
  if (spending.length) {
    lines.push({
      key: "spent",
      text: `${fmt.money(spent)} spent`,
      detail: listNames(
        spending.map(
          (row) =>
            row.description?.trim() ||
            (row.category_id ? categoryName.get(row.category_id) : undefined) ||
            "Spending",
        ),
      ),
    });
  }
  const income = today
    .filter((row) => row.kind === "income")
    .reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);
  if (income > 0) lines.push({ key: "income", text: `${fmt.money(income)} received` });

  const meals = input.foodLogs.filter((row) => row.log_date === date);
  if (meals.length) {
    const calories = Math.round(meals.reduce((sum, row) => sum + Number(row.calories ?? 0), 0));
    lines.push({
      key: "food",
      text: `${calories.toLocaleString()} kcal logged`,
      detail: `${meals.length} ${meals.length === 1 ? "entry" : "entries"}`,
    });
  }

  const medicationName = new Map(input.medications.map((row) => [row.id, row.name]));
  const taken = input.medicationLogs.filter((row) => row.log_date === date && row.taken);
  if (taken.length) {
    lines.push({
      key: "medication",
      text: `${taken.length} ${taken.length === 1 ? "dose" : "doses"} taken`,
      detail: listNames(taken.map((row) => medicationName.get(row.medication_id) ?? "Medication")),
    });
  }

  const resourceName = new Map(input.resources.map((row) => [row.id, row]));
  const read = input.readings.filter((row) => localDay(row.reading_at) === date);
  if (read.length) {
    lines.push({
      key: "readings",
      text: `${read.length} ${read.length === 1 ? "reading" : "readings"} recorded`,
      detail: listNames(
        read.map((row) => {
          const resource = resourceName.get(row.resource_id);
          const unit = resource?.unit ? ` ${resource.unit}` : "";
          return `${resource?.name ?? "Meter"} ${row.reading}${unit}`;
        }),
      ),
    });
  }

  if (input.sleepMinutes)
    lines.push({ key: "sleep", text: `${fmt.duration(input.sleepMinutes)} sleep` });
  if (input.prayersLogged) {
    lines.push({ key: "prayers", text: `${input.prayersLogged} of 5 prayers logged` });
  }
  if (input.habitsTicked) {
    lines.push({
      key: "habits",
      text: `${input.habitsTicked} ${input.habitsTicked === 1 ? "habit" : "habits"} ticked`,
    });
  }
  if (input.minutesTracked) {
    lines.push({ key: "time", text: `${fmt.duration(input.minutesTracked)} tracked` });
  }
  return lines;
}
