import {
  Baby,
  Banknote,
  Bike,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Car,
  Circle,
  Code2,
  Coffee,
  Dumbbell,
  Gamepad2,
  GraduationCap,
  Hammer,
  HandHeart,
  HeartPulse,
  Home,
  Laptop,
  MapPinned,
  Music,
  Palette,
  Plane,
  Salad,
  School,
  ShoppingBasket,
  Sparkles,
  Target,
  Trees,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type EntityIdentityValue = { icon: string | null; color: string | null };

const ICONS: { name: string; label: string; icon: LucideIcon; keywords: string }[] = [
  { name: "briefcase-business", label: "Work", icon: BriefcaseBusiness, keywords: "career office professional" },
  { name: "target", label: "Target", icon: Target, keywords: "goal focus" },
  { name: "graduation-cap", label: "Study", icon: GraduationCap, keywords: "education university" },
  { name: "book-open", label: "Reading", icon: BookOpen, keywords: "knowledge learn" },
  { name: "school", label: "School", icon: School, keywords: "study education" },
  { name: "home", label: "Home", icon: Home, keywords: "house family" },
  { name: "building-2", label: "Building", icon: Building2, keywords: "office property" },
  { name: "wallet", label: "Wallet", icon: Wallet, keywords: "money finance account" },
  { name: "banknote", label: "Money", icon: Banknote, keywords: "cash income salary" },
  { name: "heart-pulse", label: "Health", icon: HeartPulse, keywords: "medical wellbeing" },
  { name: "dumbbell", label: "Fitness", icon: Dumbbell, keywords: "gym exercise training" },
  { name: "bike", label: "Cycling", icon: Bike, keywords: "fitness travel" },
  { name: "salad", label: "Food", icon: Salad, keywords: "health groceries meal" },
  { name: "utensils", label: "Dining", icon: Utensils, keywords: "food restaurant" },
  { name: "shopping-basket", label: "Shopping", icon: ShoppingBasket, keywords: "groceries purchase" },
  { name: "coffee", label: "Coffee", icon: Coffee, keywords: "food cafe break" },
  { name: "plane", label: "Travel", icon: Plane, keywords: "flight holiday" },
  { name: "car", label: "Transport", icon: Car, keywords: "travel driving" },
  { name: "map", label: "Explore", icon: MapPinned, keywords: "travel places" },
  { name: "laptop", label: "Technology", icon: Laptop, keywords: "computer work" },
  { name: "code-2", label: "Code", icon: Code2, keywords: "technology software" },
  { name: "gamepad-2", label: "Games", icon: Gamepad2, keywords: "hobby play" },
  { name: "music", label: "Music", icon: Music, keywords: "hobby audio" },
  { name: "palette", label: "Creative", icon: Palette, keywords: "art hobby design" },
  { name: "hammer", label: "Making", icon: Hammer, keywords: "diy home craft" },
  { name: "trees", label: "Outdoors", icon: Trees, keywords: "nature hobby" },
  { name: "users", label: "People", icon: Users, keywords: "family team community" },
  { name: "baby", label: "Children", icon: Baby, keywords: "family child" },
  { name: "hand-heart", label: "Care", icon: HandHeart, keywords: "family support" },
  { name: "sparkles", label: "Growth", icon: Sparkles, keywords: "capability improvement" },
];

export const ENTITY_COLORS = [
  { value: "var(--entity-blue)", label: "Blue" },
  { value: "var(--entity-teal)", label: "Teal" },
  { value: "var(--entity-green)", label: "Green" },
  { value: "var(--entity-amber)", label: "Amber" },
  { value: "var(--entity-coral)", label: "Coral" },
  { value: "var(--entity-rose)", label: "Rose" },
  { value: "var(--entity-violet)", label: "Violet" },
  { value: "var(--entity-slate)", label: "Slate" },
] as const;

const ICON_MAP = new Map(ICONS.map((item) => [item.name, item.icon]));

export function EntityIcon({
  icon,
  color,
  className,
  containerClassName,
}: {
  icon?: string | null;
  color?: string | null;
  className?: string;
  containerClassName?: string;
}) {
  const Icon = (icon && ICON_MAP.get(icon)) || Circle;
  return (
    <span
      className={cn("grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-muted", containerClassName)}
      style={color ? { color } : undefined}
      aria-hidden="true"
    >
      <Icon className={cn("size-4", !color && "text-muted-foreground", className)} />
    </span>
  );
}

export function EntityIdentityPicker({
  value,
  onChange,
}: {
  value: EntityIdentityValue;
  onChange: (value: EntityIdentityValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = ICONS.find((item) => item.name === value.icon);

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-2">
        <Label>Icon</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-12 w-full min-w-0 justify-start">
              <EntityIcon icon={value.icon} color={value.color} containerClassName="size-7 border-0 bg-transparent" />
              <span className="truncate">{selected?.label ?? "Choose an icon"}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-0">
            <Command>
              <CommandInput placeholder="Search icons…" />
              <CommandList>
                <CommandEmpty>No matching icon.</CommandEmpty>
                <CommandGroup heading="Icons">
                  {ICONS.map((item) => (
                    <CommandItem
                      key={item.name}
                      value={`${item.label} ${item.keywords}`}
                      onSelect={() => {
                        onChange({ ...value, icon: item.name });
                        setOpen(false);
                      }}
                    >
                      <item.icon />
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-medium">Colour</legend>
        <div className="flex min-h-12 flex-wrap items-center gap-2">
          {ENTITY_COLORS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-label={item.label}
              aria-pressed={value.color === item.value}
              title={item.label}
              className={cn(
                "size-9 rounded-full border-2 border-background ring-1 ring-border transition-transform hover:scale-105",
                value.color === item.value && "ring-2 ring-foreground",
              )}
              style={{ backgroundColor: item.value }}
              onClick={() => onChange({ ...value, color: item.value })}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}