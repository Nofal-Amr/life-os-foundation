import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  CheckSquare,
  CloudOff,
  HeartPulse,
  LayoutDashboard,
  Lock,
  Moon,
  Smartphone,
  Wallet,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { currentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Life OS · Your day, money, body and prayers in one calm place" },
      {
        name: "description",
        content:
          "A private personal system for tasks, money, health and prayer. It only shows what you logged, and it works offline.",
      },
    ],
  }),
  // Signed in already: straight to Today. getSession works offline too.
  beforeLoad: async () => {
    if (await currentUser()) throw redirect({ to: "/dashboard" });
  },
  component: Intro,
});

const SECTIONS = [
  {
    key: "today",
    label: "Today",
    icon: LayoutDashboard,
    title: "One next step, not a wall of lists",
    body: "Today picks the one thing to do next and keeps the rest out of the way. Week lays out what is due and what you already did. Time tracks how long things take, from gaming to deep work.",
    points: ["Next action", "Week view", "Timers for tasks and activities"],
  },
  {
    key: "do",
    label: "Do",
    icon: CheckSquare,
    title: "Tasks that fit the day you actually have",
    body: "Tasks, projects, goals and habits in one place. Split a big task across several days, shrink it into a first small step, or time it while you work.",
    points: ["Split across days", "Shrink it", "Projects and goals"],
  },
  {
    key: "money",
    label: "Money",
    icon: Wallet,
    title: "What you can still spend before payday",
    body: "Log spending in two taps and see what is left. Savings accounts stay separate, recurring costs show up before they land, and prepaid electricity readings show which price tier you are in.",
    points: ["Left to spend", "Separate accounts", "Electricity tiers"],
  },
  {
    key: "body",
    label: "Body",
    icon: HeartPulse,
    title: "Health from your own readings",
    body: "Meals in a tap, weight, sleep and medication. On Android, steps and sleep can come straight from Samsung Health, and you can import your past Samsung data.",
    points: ["Quick meals", "Samsung Health", "History charts"],
  },
  {
    key: "spirit",
    label: "Spirit",
    icon: Moon,
    title: "Prayers, logged the way they happened",
    body: "Mark each prayer as in jamaah, on time, late or missed. Prayer times come from your location, and a reminder can arrive before and at the time itself.",
    points: ["Four prayer statuses", "Prayer-time reminders", "History you can read"],
  },
] as const;

const PRINCIPLES = [
  {
    icon: CheckSquare,
    title: "Only what you logged",
    body: "No invented scores or targets. A chart with too little data says so instead of guessing.",
  },
  {
    icon: CloudOff,
    title: "Works offline",
    body: "Open it with no signal and it shows your last data. Changes wait and sync when you are back online.",
  },
  {
    icon: Lock,
    title: "Private to you",
    body: "Your entries are tied to your account and visible only to you.",
  },
  {
    icon: BellRing,
    title: "Gentle by default",
    body: "No streaks shouting at you. If you like a game, switch on the RPG skin for levels and XP worked out from your real logs.",
  },
] as const;

function Intro() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
        <span className="text-base font-semibold tracking-tight">Life OS</span>
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main>
        <Hero />
        <Principles />
        <Everywhere />
        <Closing />
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-6 text-sm text-muted-foreground md:px-8">
        <span>Life OS</span>
        <Link to="/auth" className="underline-offset-4 hover:text-foreground hover:underline">
          Sign in
        </Link>
      </footer>
    </div>
  );
}

function Hero() {
  const [active, setActive] = useState<(typeof SECTIONS)[number]["key"]>("today");
  const section = SECTIONS.find((item) => item.key === active)!;

  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 pt-10 md:grid-cols-[1.05fr_1fr] md:items-center md:gap-14 md:px-8 md:pb-28 md:pt-16">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out">
        <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.035em] md:text-6xl">
          Your day, money, body and prayers in one calm place.
        </h1>
        <p className="mt-5 max-w-[46ch] text-lg text-muted-foreground">
          A private personal system that only shows what you logged, and keeps working when you are
          offline.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="px-6">
            <Link to="/auth" search={{ mode: "signup" } as never}>
              Get started
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      {/* The five sections of the app. Pick one to see what it does. */}
      <div className="stat-card animate-in fade-in slide-in-from-bottom-3 p-2 delay-100 duration-500 ease-out fill-mode-backwards">
        <div
          role="tablist"
          aria-label="Sections of Life OS"
          className="grid grid-cols-5 gap-1 rounded-xl bg-muted p-1"
        >
          {SECTIONS.map(({ key, label, icon: Icon }) => {
            const selected = key === active;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`tab-${key}`}
                aria-selected={selected}
                aria-controls="section-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(key)}
                onKeyDown={(event) => {
                  const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                  if (!step) return;
                  event.preventDefault();
                  const index = SECTIONS.findIndex((item) => item.key === key);
                  const next = SECTIONS[(index + step + SECTIONS.length) % SECTIONS.length]!;
                  setActive(next.key);
                  document.getElementById(`tab-${next.key}`)?.focus();
                }}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs transition-[color,background-color,scale] duration-150 ease-out active:scale-[0.97]",
                  selected
                    ? "bg-card font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("size-5", selected && "text-primary")}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {label}
              </button>
            );
          })}
        </div>

        <div
          id="section-panel"
          role="tabpanel"
          aria-labelledby={`tab-${section.key}`}
          className="min-h-[17rem] px-4 pb-5 pt-6 md:px-6"
        >
          {/* Keyed so each section eases in when picked. */}
          <div key={section.key} className="animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out">
            <h2 className="text-xl font-semibold tracking-[-0.015em]">{section.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {section.points.map((point) => (
                <li
                  key={point}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-sm"
                >
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Principles() {
  return (
    <section className="border-y border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-[0.8fr_1.2fr] md:px-8 md:py-24">
        <h2 className="max-w-[16ch] text-3xl font-semibold leading-tight tracking-[-0.025em] md:text-4xl">
          Built to be honest with you.
        </h2>
        <dl className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <dt className="flex items-center gap-2.5 font-medium">
                <Icon className="size-[18px] text-primary" strokeWidth={1.75} aria-hidden="true" />
                {title}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Everywhere() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-24">
      <h2 className="max-w-[20ch] text-3xl font-semibold leading-tight tracking-[-0.025em] md:text-4xl">
        On your laptop and in your pocket.
      </h2>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <div className="stat-card p-6 md:col-span-2">
          <Smartphone className="size-6 text-primary" strokeWidth={1.75} aria-hidden="true" />
          <h3 className="mt-4 text-lg font-semibold">The web and the Android app stay in sync</h3>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
            Log a meal on your phone and it is on your laptop the next time you open it. On Android you also
            get reminders for prayers and tasks, a timer in your notifications, and Samsung Health.
          </p>
        </div>
        <div className="stat-card p-6">
          <BellRing className="size-6 text-primary" strokeWidth={1.75} aria-hidden="true" />
          <h3 className="mt-4 text-lg font-semibold">One button to log anything</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Spending, a meal, a timer, a task, a note or a prayer, from any page in a tap or two.
          </p>
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 md:px-8">
      <div className="stat-card flex flex-col items-start gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-10">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.02em] md:text-3xl">
            Start with a blank page.
          </h2>
          <p className="mt-2 max-w-[48ch] text-muted-foreground">
            Nothing is filled in for you. Setup lets you switch off what you don't need, and you can change it any time.
          </p>
        </div>
        <Button asChild size="lg" className="px-6">
          <Link to="/auth" search={{ mode: "signup" } as never}>
            Get started
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
