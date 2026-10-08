import { Languages } from "lucide-react";

import { getLang, setLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** English or Arabic for this device; Arabic also turns the layout right-to-left. */
export function LanguageCard() {
  const current = getLang();
  const choose = (lang: Lang) => {
    if (lang === current) return;
    setLang(lang);
    // Reload so every screen picks up the language and direction at once.
    window.location.reload();
  };
  return (
    <section className="stat-card space-y-3 p-5">
      <p className="flex items-center gap-2 text-base font-semibold">
        <Languages className="size-4" /> Language · اللغة
      </p>
      <div
        className="flex gap-1 rounded-lg bg-secondary p-1"
        role="radiogroup"
        aria-label="Language"
      >
        {(
          [
            { value: "en", label: "English" },
            { value: "ar", label: "العربية" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={current === option.value}
            lang={option.value}
            onClick={() => choose(option.value)}
            className={cn(
              "min-h-10 flex-1 rounded-md text-sm font-medium transition-colors",
              current === option.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground" dir="ltr" lang="en">
        Arabic covers the menus, buttons and page titles first; more of the app follows.
      </p>
      <p className="text-xs text-muted-foreground" dir="rtl" lang="ar">
        العربية تشمل القوائم والأزرار وعناوين الصفحات أولًا، والباقي يتبع.
      </p>
    </section>
  );
}
