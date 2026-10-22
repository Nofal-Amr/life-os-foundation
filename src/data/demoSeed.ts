/**
 * Sample data for demo mode: a believable month of someone using Life OS,
 * dated around today so every screen has something real-looking to show.
 * Only used in demo mode; never sent anywhere.
 */
import { addDays, format, subDays } from "date-fns";

import { ADO_PRESET } from "./work/rules";

export const DEMO_USER = "00000000-0000-4000-8000-00000000de30";

type Row = Record<string, unknown>;
export type DemoDb = Record<string, Row[]>;

let counter = 0;
const id = (prefix: string) =>
  `${prefix.padEnd(8, "0").slice(0, 8)}-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

export function demoSeed(now = new Date()): DemoDb {
  counter = 0;
  const day = (offset: number) => format(addDays(now, offset), "yyyy-MM-dd");
  const iso = (offset: number, time: string) => new Date(`${day(offset)}T${time}:00`).toISOString();
  const stamp = (offset = 0) => addDays(now, offset).toISOString();
  const base = (extra: Row): Row => ({
    user_id: DEMO_USER,
    created_at: stamp(-40),
    updated_at: stamp(-1),
    ...extra,
  });

  const work = id("project");
  const home = id("project");
  const fit = id("goal");
  const tasks: Row[] = [
    {
      title: "Send the quarterly report to Ahmed",
      due_date: day(0),
      due_time: "11:00",
      priority: "high",
      project_id: work,
      energy: 2,
    },
    { title: "Renew car licence", due_date: day(2), priority: "medium", project_id: home },
    { title: "Book dentist appointment", due_date: day(-3), priority: "medium", energy: 1 },
    {
      title: "Prepare slides for Sunday meeting",
      due_date: day(3),
      due_time: "09:00",
      priority: "high",
      project_id: work,
      energy: 3,
    },
    { title: "Call the electricity company about the meter", status: "inbox" },
    { title: "Buy a birthday gift for Mona", due_date: day(5), priority: "low" },
    // A task that has waited over a month (the stuck-task helper picks it up).
    {
      title: "Finish the kaitech proposal",
      priority: "high",
      project_id: work,
      created_at: stamp(-38),
      updated_at: stamp(-30),
      postponed_count: 3,
      original_due_date: day(-30),
      due_date: day(-6),
    },
    {
      title: "Pay the internet bill",
      status: "completed",
      completed_at: stamp(-1),
      due_date: day(-1),
    },
    { title: "Clean the desk", status: "completed", completed_at: stamp(0), due_date: day(0) },
  ].map((task, index) =>
    base({
      id: id("task"),
      status: "todo",
      priority: "medium",
      position: index,
      postponed_count: 0,
      description: null,
      due_date: null,
      due_time: null,
      energy: null,
      estimated_minutes: null,
      estimate_unit: null,
      project_id: null,
      goal_id: null,
      capability_id: null,
      parent_task_id: null,
      repeat: null,
      start_date: null,
      max_date: null,
      original_due_date: null,
      last_postponed_at: null,
      completed_at: null,
      ...task,
    }),
  );
  // Two small steps under the report.
  tasks.push(
    base({
      ...tasks[0],
      id: id("task"),
      title: "Pull last quarter's numbers",
      parent_task_id: tasks[0]!["id"],
      status: "completed",
      completed_at: stamp(0),
      due_time: null,
      position: 0,
    }),
    base({
      ...tasks[0],
      id: id("task"),
      title: "Write the summary paragraph",
      parent_task_id: tasks[0]!["id"],
      due_time: null,
      position: 1,
    }),
  );

  const wallet = id("account");
  const bank = id("account");
  const food = id("categry");
  const transport = id("categry");
  const bills = id("categry");
  const salary = id("categry");
  const transactions: Row[] = [];
  for (let back = 0; back < 25; back++) {
    if (back % 2 === 0)
      transactions.push({
        kind: "expense",
        amount: 85 + ((back * 37) % 140),
        category_id: food,
        account_id: wallet,
        description: back % 4 ? "Lunch" : "Groceries",
        date: day(-back),
      });
    if (back % 3 === 0)
      transactions.push({
        kind: "expense",
        amount: 40 + ((back * 13) % 60),
        category_id: transport,
        account_id: wallet,
        description: "Uber",
        date: day(-back),
      });
  }
  transactions.push({
    kind: "income",
    amount: 9500,
    category_id: salary,
    account_id: bank,
    description: "Salary",
    date: day(-20),
  });
  transactions.push({
    kind: "expense",
    amount: 650,
    category_id: bills,
    account_id: bank,
    description: "Electricity",
    date: day(-12),
  });

  const habits = [
    { name: "Read 10 pages", icon: "book-open", color: "chart-2" },
    { name: "Walk 30 minutes", icon: "footprints", color: "chart-1" },
    { name: "No phone after 11pm", icon: "moon", color: "chart-3" },
  ].map((habit) =>
    base({
      id: id("habit"),
      active: true,
      frequency: "daily",
      target: 1,
      category: null,
      description: null,
      ...habit,
    }),
  );
  const habitLogs: Row[] = [];
  habits.forEach((habit, index) => {
    for (let back = 0; back < 20; back++) {
      if ((back + index) % (index + 2) !== 0)
        habitLogs.push(base({ id: id("hlog"), habit_id: habit["id"], log_date: day(-back) }));
    }
  });

  const names = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  const statuses = ["on_time", "jamaah", "on_time", "late", "on_time", "clutch", "on_time"];
  const prayerLogs: Row[] = [];
  for (let back = 1; back < 21; back++) {
    names.forEach((name, index) => {
      if ((back * 3 + index) % 11 === 0) return; // a few not logged
      const status = statuses[(back + index) % statuses.length]!;
      prayerLogs.push(
        base({
          id: id("prayer"),
          prayer_date: day(-back),
          prayer_name: name,
          status,
          completed: true,
          on_time: status !== "late",
        }),
      );
    });
  }
  prayerLogs.push(
    base({
      id: id("prayer"),
      prayer_date: day(0),
      prayer_name: "fajr",
      status: "on_time",
      completed: true,
      on_time: true,
    }),
  );

  const healthLogs: Row[] = [];
  for (let back = 0; back < 14; back++) {
    healthLogs.push(
      base({
        id: id("health"),
        log_date: day(-back),
        sleep_hours: 6 + ((back * 7) % 25) / 10,
        mood: 3 + (back % 3),
        trained: back % 3 === 0,
        water_ok: back % 2 === 0,
        note: null,
      }),
    );
  }

  const org = id("workorg");
  const office = id("place");
  const workEvents: Row[] = [];
  for (let back = 1; back < 15; back++) {
    const date = subDays(now, back);
    if ([5, 6].includes(date.getDay())) continue;
    const inAt = `08:${String((back * 7) % 40).padStart(2, "0")}`;
    const outAt = back % 4 === 0 ? "18:20" : "16:35";
    for (const [kind, time] of [
      ["in", inAt],
      ["out", outAt],
    ] as const) {
      workEvents.push({
        id: id("wevent"),
        org_id: org,
        user_id: DEMO_USER,
        kind,
        at: iso(-back, time),
        place_id: office,
        place_kind: "office",
        verified: "biometric",
        mock: false,
        sent_late: false,
        reason: null,
        latitude: 30.0444,
        longitude: 31.2357,
        accuracy_m: 12,
        distance_m: 8,
        created_at: iso(-back, time),
      });
    }
  }

  return {
    user_preferences: [
      base({
        id: id("prefs"),
        onboarding_completed_at: stamp(-40),
        enabled_modules: [
          "do",
          "money",
          "body",
          "spirit",
          "habits",
          "notes",
          "calendar",
          "study",
          "food",
          "resources",
        ],
        skin: "serious",
        currency: "EGP",
        date_format: "d MMM yyyy",
        time_format: "12h",
        unit_system: "metric",
        week_start: 6,
        dimension_order: null,
        food_prefs: null,
        connect_key: null,
      }),
    ],
    profiles: [base({ id: id("profile"), display_name: "Demo", avatar_url: null })],
    projects: [
      base({
        id: work,
        name: "Work: Q4 report",
        status: "active",
        priority: "high",
        icon: "briefcase",
        color: "chart-1",
        due_date: day(10),
        start_date: day(-20),
        description: null,
        image_url: null,
      }),
      base({
        id: home,
        name: "Home admin",
        status: "active",
        priority: "medium",
        icon: "home",
        color: "chart-2",
        due_date: null,
        start_date: null,
        description: null,
        image_url: null,
      }),
    ],
    goals: [
      base({
        id: fit,
        name: "Run 5 km without stopping",
        status: "active",
        progress: 40,
        target_date: day(45),
        icon: "footprints",
        color: "chart-3",
        category: "body",
        description: null,
        image_url: null,
        project_id: null,
      }),
    ],
    tasks,
    habits,
    habit_logs: habitLogs,
    accounts: [
      base({
        id: wallet,
        name: "Wallet",
        type: "cash",
        opening_balance: 2400,
        active: true,
        counts_toward_spendable: true,
        currency: "EGP",
        icon: "wallet",
        color: null,
      }),
      base({
        id: bank,
        name: "Bank",
        type: "checking",
        opening_balance: 6200,
        active: true,
        counts_toward_spendable: true,
        currency: "EGP",
        icon: "landmark",
        color: null,
      }),
    ],
    finance_categories: [
      base({
        id: food,
        name: "Food",
        kind: "expense",
        icon: "utensils",
        color: "chart-2",
        monthly_budget: 3000,
      }),
      base({
        id: transport,
        name: "Transport",
        kind: "expense",
        icon: "car",
        color: "chart-1",
        monthly_budget: 1200,
      }),
      base({
        id: bills,
        name: "Bills",
        kind: "expense",
        icon: "receipt",
        color: "chart-4",
        monthly_budget: null,
      }),
      base({
        id: salary,
        name: "Salary",
        kind: "income",
        icon: "banknote",
        color: "chart-3",
        monthly_budget: null,
      }),
    ],
    transactions: transactions.map((row) =>
      base({ id: id("txn"), occurred_time: null, pocket_id: null, ...row }),
    ),
    recurring_costs: [
      base({
        id: id("recur"),
        name: "Internet",
        amount: -450,
        active: true,
        frequency: "monthly",
        interval_count: 1,
        interval_unit: null,
        next_due_date: day(8),
        next_due_at: null,
        account_id: bank,
        category_id: bills,
      }),
      base({
        id: id("recur"),
        name: "Gym",
        amount: -600,
        active: true,
        frequency: "monthly",
        interval_count: 1,
        interval_unit: null,
        next_due_date: day(4),
        next_due_at: null,
        account_id: bank,
        category_id: null,
      }),
    ],
    payday_config: [
      base({
        id: id("payday"),
        schedule: "monthly",
        pay_day: Number(format(addDays(now, 10), "d")),
        expected_net_amount: 9500,
        safety_buffer: 500,
        anchor_date: null,
        interval_weeks: null,
      }),
    ],
    prayer_settings: [
      base({
        id: id("pset"),
        latitude: 30.0444,
        longitude: 31.2357,
        city: "Cairo",
        calc_method: "Egyptian",
        asr_school: "shafi",
      }),
    ],
    prayer_logs: prayerLogs,
    health_logs: healthLogs,
    notes: [
      base({
        id: id("note"),
        title: "Ideas for the weekend",
        body: "Visit the Grand Egyptian Museum\nTry the new koshary place\nCall grandma",
        tags: ["Ideas"],
        pinned: true,
        archived: false,
        color: null,
        checklist: null,
      }),
      base({
        id: id("note"),
        title: "Meeting: budget review",
        body: "Who: Ahmed, Sara\n\nWhat was decided: cut travel by 10%\n\nWhat I have to do: update the sheet by Thursday",
        tags: ["Meeting"],
        pinned: false,
        archived: false,
        color: "blue",
        checklist: null,
      }),
      base({
        id: id("note"),
        title: "Groceries",
        body: null,
        tags: ["Lists"],
        pinned: false,
        archived: false,
        color: null,
        checklist: [
          { id: "a", text: "Milk", done: true },
          { id: "b", text: "Eggs", done: false },
          { id: "c", text: "Bread", done: false },
        ],
      }),
    ],
    events: [
      base({
        id: id("event"),
        title: "Team stand-up",
        description: null,
        start_at: iso(0, "10:00"),
        end_at: iso(0, "10:30"),
      }),
      base({
        id: id("event"),
        title: "Lunch with Omar",
        description: "Zamalek",
        start_at: iso(1, "14:00"),
        end_at: iso(1, "15:30"),
      }),
      base({
        id: id("event"),
        title: "Gym",
        description: null,
        start_at: iso(2, "19:00"),
        end_at: iso(2, "20:00"),
      }),
      base({
        id: id("event"),
        title: "Client call",
        description: null,
        start_at: iso(0, "15:00"),
        end_at: iso(0, "16:00"),
      }),
      base({
        id: id("event"),
        title: "Mona's birthday",
        description: null,
        start_at: `${day(5)}T00:00:00`,
        end_at: null,
      }),
    ],
    daily_reviews: [
      base({
        id: id("review"),
        review_date: day(0),
        energy: 3,
        mood: 4,
        wins: null,
        challenges: null,
        gratitude: null,
        tomorrow_focus: null,
      }),
    ],
    work_orgs: [
      {
        id: org,
        name: "Demo Co.",
        invite_code: "DEMO23",
        rules: ADO_PRESET,
        created_by: DEMO_USER,
        created_at: stamp(-30),
        updated_at: stamp(-30),
      },
    ],
    work_members: [
      {
        org_id: org,
        user_id: DEMO_USER,
        display_name: "Demo",
        role: "owner",
        base_salary: 9500,
        overtime_rate: null,
        place_ids: null,
        joined_at: stamp(-30),
      },
    ],
    work_places: [
      {
        id: office,
        org_id: org,
        name: "Office",
        kind: "office",
        latitude: 30.0444,
        longitude: 31.2357,
        radius_m: 50,
        created_at: stamp(-30),
      },
    ],
    work_events: workEvents,
  };
}
