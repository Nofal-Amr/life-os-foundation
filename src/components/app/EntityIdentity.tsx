import {
  Activity,
  AirVent,
  AlarmClock,
  Anchor,
  Apple,
  Armchair,
  Award,
  Baby,
  Backpack,
  Banknote,
  BatteryCharging,
  Beef,
  Bed,
  Bike,
  Bird,
  Blocks,
  Bone,
  BookOpen,
  BookMarked,
  Bot,
  Box,
  BrainCog,
  Briefcase,
  BriefcaseBusiness,
  Brush,
  Building2,
  Bus,
  Cake,
  Calculator,
  CalendarDays,
  Camera,
  CandlestickChart,
  Car,
  Carrot,
  ChefHat,
  Cigarette,
  Circle,
  ClipboardList,
  Clock,
  Cloud,
  Code2,
  Coffee,
  Coins,
  Compass,
  Cookie,
  CreditCard,
  Croissant,
  Cpu,
  Database,
  Dog,
  DoorOpen,
  Droplet,
  Drumstick,
  Dumbbell,
  Egg,
  Fan,
  Feather,
  Film,
  Fish,
  Flame,
  FlaskConical,
  Flower2,
  Folder,
  Footprints,
  Fuel,
  Gamepad2,
  Gauge,
  Gift,
  Glasses,
  Globe,
  GraduationCap,
  Grape,
  Guitar,
  HandHeart,
  Hammer,
  Handshake,
  HardDrive,
  Headphones,
  Heart,
  HeartPulse,
  Home,
  Hospital,
  Hourglass,
  IceCream,
  Infinity as InfinityIcon,
  Key,
  Lamp,
  Landmark,
  Laptop,
  Leaf,
  Library,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  Luggage,
  Mail,
  Map as MapIcon,
  MapPinned,
  Medal,
  Megaphone,
  Microscope,
  Milk,
  Monitor,
  Moon,
  Mountain,
  MousePointer2,
  Music,
  Newspaper,
  Notebook,
  Package,
  PaintRoller,
  Palette,
  PartyPopper,
  PawPrint,
  PenTool,
  PersonStanding,
  Phone,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Plug,
  Presentation,
  Printer,
  Puzzle,
  Receipt,
  Recycle,
  Refrigerator,
  Ruler,
  Salad,
  Sandwich,
  Scale,
  School,
  Scissors,
  Send,
  Settings2,
  ShieldCheck,
  Ship,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Shirt,
  ShowerHead,
  Signal,
  Smartphone,
  Snowflake,
  Sofa,
  Soup,
  Sparkles,
  Star,
  Stethoscope,
  Store,
  Sun,
  Sunrise,
  Syringe,
  Table as TableIcon,
  Tag,
  Target,
  Tent,
  Thermometer,
  Ticket,
  Timer,
  Train,
  TrendingUp,
  Trees,
  Trophy,
  Truck,
  Tv,
  Umbrella,
  Users,
  Utensils,
  Video,
  Wallet,
  Wallpaper,
  Watch,
  Waves,
  Wheat,
  Wifi,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type EntityIdentityValue = { icon: string | null; color: string | null };

type IconEntry = {
  name: string;
  label: string;
  icon: LucideIcon;
  keywords: string;
  group: string;
};

/**
 * A curated set only — never the whole lucide library, so the bundle stays small.
 * Every name already stored in the database stays in this list.
 */
const ICONS: IconEntry[] = [
  // Work
  { name: "briefcase-business", label: "Work", icon: BriefcaseBusiness, keywords: "career office professional job", group: "Work" },
  { name: "briefcase", label: "Briefcase", icon: Briefcase, keywords: "work job business", group: "Work" },
  { name: "target", label: "Target", icon: Target, keywords: "goal focus aim", group: "Work" },
  { name: "list-checks", label: "Checklist", icon: ListChecks, keywords: "tasks todo work", group: "Work" },
  { name: "clipboard-list", label: "Clipboard", icon: ClipboardList, keywords: "tasks notes admin", group: "Work" },
  { name: "presentation", label: "Presentation", icon: Presentation, keywords: "meeting slides work", group: "Work" },
  { name: "handshake", label: "Agreement", icon: Handshake, keywords: "deal client partner", group: "Work" },
  { name: "megaphone", label: "Marketing", icon: Megaphone, keywords: "announce promote work", group: "Work" },
  { name: "mail", label: "Email", icon: Mail, keywords: "inbox message work", group: "Work" },
  { name: "send", label: "Send", icon: Send, keywords: "submit deliver message", group: "Work" },
  { name: "printer", label: "Printer", icon: Printer, keywords: "paperwork office", group: "Work" },
  { name: "folder", label: "Folder", icon: Folder, keywords: "files documents", group: "Work" },
  { name: "calendar-days", label: "Calendar", icon: CalendarDays, keywords: "schedule dates", group: "Work" },
  { name: "clock", label: "Clock", icon: Clock, keywords: "time hours", group: "Work" },
  { name: "timer", label: "Timer", icon: Timer, keywords: "time focus session", group: "Work" },
  { name: "alarm-clock", label: "Alarm", icon: AlarmClock, keywords: "wake reminder time", group: "Work" },
  { name: "hourglass", label: "Hourglass", icon: Hourglass, keywords: "time waiting", group: "Work" },
  { name: "settings-2", label: "Settings", icon: Settings2, keywords: "setup config admin", group: "Work" },

  // Money
  { name: "wallet", label: "Wallet", icon: Wallet, keywords: "money finance account", group: "Money" },
  { name: "banknote", label: "Cash", icon: Banknote, keywords: "money income salary notes", group: "Money" },
  { name: "coins", label: "Coins", icon: Coins, keywords: "money change cash", group: "Money" },
  { name: "piggy-bank", label: "Savings", icon: PiggyBank, keywords: "save money fund", group: "Money" },
  { name: "credit-card", label: "Card", icon: CreditCard, keywords: "debit credit bank payment", group: "Money" },
  { name: "landmark", label: "Bank", icon: Landmark, keywords: "bank account institution", group: "Money" },
  { name: "receipt", label: "Bill", icon: Receipt, keywords: "receipt bill invoice expense", group: "Money" },
  { name: "calculator", label: "Calculator", icon: Calculator, keywords: "budget maths money", group: "Money" },
  { name: "trending-up", label: "Growth", icon: TrendingUp, keywords: "income increase invest", group: "Money" },
  { name: "candlestick-chart", label: "Investing", icon: CandlestickChart, keywords: "stocks invest market", group: "Money" },
  { name: "scale", label: "Balance", icon: Scale, keywords: "compare weigh fair", group: "Money" },
  { name: "tag", label: "Price", icon: Tag, keywords: "cost label price", group: "Money" },
  { name: "ticket", label: "Ticket", icon: Ticket, keywords: "event travel ticket", group: "Money" },
  { name: "gift", label: "Gift", icon: Gift, keywords: "present giving charity", group: "Money" },

  // Home
  { name: "home", label: "Home", icon: Home, keywords: "house family rent", group: "Home" },
  { name: "building-2", label: "Building", icon: Building2, keywords: "office property flat", group: "Home" },
  { name: "door-open", label: "Door", icon: DoorOpen, keywords: "home entry rent", group: "Home" },
  { name: "key", label: "Keys", icon: Key, keywords: "home rent access", group: "Home" },
  { name: "zap", label: "Electricity", icon: Zap, keywords: "power energy electric meter kwh", group: "Home" },
  { name: "plug", label: "Power", icon: Plug, keywords: "electricity socket energy", group: "Home" },
  { name: "lightbulb", label: "Light", icon: Lightbulb, keywords: "electricity bulb idea", group: "Home" },
  { name: "battery-charging", label: "Battery", icon: BatteryCharging, keywords: "power charge energy", group: "Home" },
  { name: "droplet", label: "Water", icon: Droplet, keywords: "water meter utility", group: "Home" },
  { name: "shower", label: "Shower", icon: ShowerHead, keywords: "water bathroom home", group: "Home" },
  { name: "flame", label: "Gas", icon: Flame, keywords: "gas heating fire energy", group: "Home" },
  { name: "thermometer", label: "Heating", icon: Thermometer, keywords: "temperature heat cold", group: "Home" },
  { name: "air-vent", label: "Air", icon: AirVent, keywords: "cooling ac ventilation", group: "Home" },
  { name: "fan", label: "Fan", icon: Fan, keywords: "cooling air", group: "Home" },
  { name: "snowflake", label: "Cooling", icon: Snowflake, keywords: "cold ac winter", group: "Home" },
  { name: "refrigerator", label: "Fridge", icon: Refrigerator, keywords: "kitchen appliance home", group: "Home" },
  { name: "sofa", label: "Sofa", icon: Sofa, keywords: "furniture living room", group: "Home" },
  { name: "armchair", label: "Chair", icon: Armchair, keywords: "furniture home", group: "Home" },
  { name: "bed", label: "Bed", icon: Bed, keywords: "sleep bedroom rest", group: "Home" },
  { name: "lamp", label: "Lamp", icon: Lamp, keywords: "light home furniture", group: "Home" },
  { name: "table", label: "Table", icon: TableIcon, keywords: "furniture home", group: "Home" },
  { name: "wallpaper", label: "Decor", icon: Wallpaper, keywords: "home decorating", group: "Home" },
  { name: "paint-roller", label: "Painting", icon: PaintRoller, keywords: "diy decorating home", group: "Home" },
  { name: "hammer", label: "Making", icon: Hammer, keywords: "diy home craft repair", group: "Home" },
  { name: "wrench", label: "Repairs", icon: Wrench, keywords: "fix maintenance diy", group: "Home" },
  { name: "recycle", label: "Recycling", icon: Recycle, keywords: "waste bins home", group: "Home" },
  { name: "box", label: "Storage", icon: Box, keywords: "boxes moving home", group: "Home" },

  // Shopping
  { name: "shopping-basket", label: "Groceries", icon: ShoppingBasket, keywords: "groceries food purchase shop", group: "Shopping" },
  { name: "shopping-cart", label: "Shopping", icon: ShoppingCart, keywords: "buy cart store", group: "Shopping" },
  { name: "shopping-bag", label: "Shopping bag", icon: ShoppingBag, keywords: "buy retail clothes", group: "Shopping" },
  { name: "store", label: "Shop", icon: Store, keywords: "store retail market", group: "Shopping" },
  { name: "package", label: "Delivery", icon: Package, keywords: "parcel order online", group: "Shopping" },
  { name: "truck", label: "Deliveries", icon: Truck, keywords: "shipping delivery logistics", group: "Shopping" },
  { name: "shirt", label: "Clothes", icon: Shirt, keywords: "clothing laundry shopping", group: "Shopping" },
  { name: "glasses", label: "Glasses", icon: Glasses, keywords: "eyes optician shopping", group: "Shopping" },
  { name: "watch", label: "Watch", icon: Watch, keywords: "time accessory", group: "Shopping" },
  { name: "scissors", label: "Haircut", icon: Scissors, keywords: "grooming barber", group: "Shopping" },

  // Health
  { name: "heart-pulse", label: "Health", icon: HeartPulse, keywords: "medical wellbeing vitals", group: "Health" },
  { name: "heart", label: "Heart", icon: Heart, keywords: "care love health", group: "Health" },
  { name: "pill", label: "Medication", icon: Pill, keywords: "medicine tablet dose pharmacy", group: "Health" },
  { name: "syringe", label: "Injection", icon: Syringe, keywords: "vaccine medical dose", group: "Health" },
  { name: "stethoscope", label: "Doctor", icon: Stethoscope, keywords: "doctor gp appointment medical", group: "Health" },
  { name: "hospital", label: "Hospital", icon: Hospital, keywords: "clinic medical appointment", group: "Health" },
  { name: "microscope", label: "Tests", icon: Microscope, keywords: "lab results medical", group: "Health" },
  { name: "flask-conical", label: "Lab", icon: FlaskConical, keywords: "tests science medical", group: "Health" },
  { name: "bone", label: "Bones", icon: Bone, keywords: "physio body medical", group: "Health" },
  { name: "brain-cog", label: "Mind", icon: BrainCog, keywords: "mental focus thinking", group: "Health" },
  { name: "activity", label: "Vitals", icon: Activity, keywords: "pulse tracking health", group: "Health" },
  { name: "life-buoy", label: "Support", icon: LifeBuoy, keywords: "help care safety", group: "Health" },
  { name: "cigarette", label: "Smoking", icon: Cigarette, keywords: "habit quit", group: "Health" },

  // Fitness
  { name: "dumbbell", label: "Fitness", icon: Dumbbell, keywords: "gym exercise training weights", group: "Fitness" },
  { name: "bike", label: "Cycling", icon: Bike, keywords: "fitness travel bicycle", group: "Fitness" },
  { name: "footprints", label: "Walking", icon: Footprints, keywords: "steps walk fitness", group: "Fitness" },
  { name: "person-standing", label: "Movement", icon: PersonStanding, keywords: "stretch posture body", group: "Fitness" },
  { name: "waves", label: "Swimming", icon: Waves, keywords: "pool water fitness", group: "Fitness" },
  { name: "trophy", label: "Trophy", icon: Trophy, keywords: "sport win milestone", group: "Fitness" },
  { name: "medal", label: "Medal", icon: Medal, keywords: "sport milestone", group: "Fitness" },
  { name: "award", label: "Award", icon: Award, keywords: "recognition milestone", group: "Fitness" },
  { name: "ruler", label: "Measurements", icon: Ruler, keywords: "size body measure", group: "Fitness" },

  // Food
  { name: "salad", label: "Salad", icon: Salad, keywords: "health greens meal food", group: "Food" },
  { name: "utensils", label: "Dining", icon: Utensils, keywords: "food restaurant eating out", group: "Food" },
  { name: "chef-hat", label: "Cooking", icon: ChefHat, keywords: "homecooked kitchen food", group: "Food" },
  { name: "soup", label: "Soup", icon: Soup, keywords: "meal warm food", group: "Food" },
  { name: "beef", label: "Meat", icon: Beef, keywords: "protein food meal", group: "Food" },
  { name: "drumstick", label: "Chicken", icon: Drumstick, keywords: "protein meat food", group: "Food" },
  { name: "fish", label: "Fish", icon: Fish, keywords: "protein seafood food", group: "Food" },
  { name: "egg", label: "Eggs", icon: Egg, keywords: "protein breakfast food", group: "Food" },
  { name: "milk", label: "Dairy", icon: Milk, keywords: "milk cheese food", group: "Food" },
  { name: "wheat", label: "Grains", icon: Wheat, keywords: "bread rice carbs food", group: "Food" },
  { name: "sandwich", label: "Sandwich", icon: Sandwich, keywords: "lunch bread food", group: "Food" },
  { name: "pizza-slice", label: "Pizza", icon: Pizza, keywords: "takeaway fast food", group: "Food" },
  { name: "apple", label: "Fruit", icon: Apple, keywords: "fruit snack healthy", group: "Food" },
  { name: "grape", label: "Grapes", icon: Grape, keywords: "fruit snack", group: "Food" },
  { name: "carrot", label: "Vegetables", icon: Carrot, keywords: "veg healthy food", group: "Food" },
  { name: "cookie", label: "Snack", icon: Cookie, keywords: "biscuit sweet snack", group: "Food" },
  { name: "cake", label: "Cake", icon: Cake, keywords: "dessert sweet birthday", group: "Food" },
  { name: "ice-cream", label: "Ice cream", icon: IceCream, keywords: "dessert sweet", group: "Food" },
  { name: "croissant", label: "Bakery", icon: Croissant, keywords: "bread breakfast pastry", group: "Food" },
  { name: "coffee", label: "Coffee", icon: Coffee, keywords: "drink cafe break tea", group: "Food" },

  // Travel
  { name: "plane", label: "Flight", icon: Plane, keywords: "travel holiday airport", group: "Travel" },
  { name: "car", label: "Car", icon: Car, keywords: "transport driving vehicle", group: "Travel" },
  { name: "fuel", label: "Fuel", icon: Fuel, keywords: "petrol diesel car transport", group: "Travel" },
  { name: "bus", label: "Bus", icon: Bus, keywords: "transport public commute", group: "Travel" },
  { name: "train", label: "Train", icon: Train, keywords: "transport commute rail", group: "Travel" },
  { name: "ship", label: "Boat", icon: Ship, keywords: "travel ferry sea", group: "Travel" },
  { name: "luggage", label: "Luggage", icon: Luggage, keywords: "travel packing trip", group: "Travel" },
  { name: "map", label: "Map", icon: MapIcon, keywords: "travel places directions", group: "Travel" },
  { name: "map-pinned", label: "Place", icon: MapPinned, keywords: "location travel pin", group: "Travel" },
  { name: "compass", label: "Compass", icon: Compass, keywords: "direction qibla navigate", group: "Travel" },
  { name: "globe", label: "World", icon: Globe, keywords: "travel international web", group: "Travel" },
  { name: "tent", label: "Camping", icon: Tent, keywords: "outdoors travel holiday", group: "Travel" },
  { name: "anchor", label: "Anchor", icon: Anchor, keywords: "sea steady travel", group: "Travel" },
  { name: "umbrella", label: "Weather", icon: Umbrella, keywords: "rain travel", group: "Travel" },

  // Learning
  { name: "graduation-cap", label: "Study", icon: GraduationCap, keywords: "education university degree", group: "Learning" },
  { name: "book-open", label: "Reading", icon: BookOpen, keywords: "knowledge learn quran book", group: "Learning" },
  { name: "book-marked", label: "Bookmarked", icon: BookMarked, keywords: "reading study reference", group: "Learning" },
  { name: "library", label: "Library", icon: Library, keywords: "books study reading", group: "Learning" },
  { name: "school", label: "School", icon: School, keywords: "study education class", group: "Learning" },
  { name: "notebook", label: "Notebook", icon: Notebook, keywords: "notes writing study", group: "Learning" },
  { name: "pen-tool", label: "Writing", icon: PenTool, keywords: "notes draft creative", group: "Learning" },
  { name: "newspaper", label: "News", icon: Newspaper, keywords: "reading articles", group: "Learning" },
  { name: "backpack", label: "Backpack", icon: Backpack, keywords: "school study bag", group: "Learning" },

  // Technology
  { name: "laptop", label: "Laptop", icon: Laptop, keywords: "computer work technology", group: "Technology" },
  { name: "monitor", label: "Desktop", icon: Monitor, keywords: "computer screen work", group: "Technology" },
  { name: "code-2", label: "Code", icon: Code2, keywords: "technology software programming", group: "Technology" },
  { name: "cpu", label: "Hardware", icon: Cpu, keywords: "computer chip technology", group: "Technology" },
  { name: "database", label: "Data", icon: Database, keywords: "storage records technology", group: "Technology" },
  { name: "hard-drive", label: "Drive", icon: HardDrive, keywords: "storage backup technology", group: "Technology" },
  { name: "wifi", label: "Internet", icon: Wifi, keywords: "wifi internet data quota broadband", group: "Technology" },
  { name: "signal", label: "Mobile data", icon: Signal, keywords: "data quota signal internet gb", group: "Technology" },
  { name: "smartphone", label: "Phone", icon: Smartphone, keywords: "mobile phone technology", group: "Technology" },
  { name: "phone", label: "Calls", icon: Phone, keywords: "phone call contact", group: "Technology" },
  { name: "gauge", label: "Meter", icon: Gauge, keywords: "reading meter usage measure", group: "Technology" },
  { name: "bot", label: "Automation", icon: Bot, keywords: "ai robot technology", group: "Technology" },
  { name: "mouse-pointer-2", label: "Pointer", icon: MousePointer2, keywords: "click interface", group: "Technology" },
  { name: "cloud", label: "Cloud", icon: Cloud, keywords: "storage internet service", group: "Technology" },
  { name: "shield-check", label: "Security", icon: ShieldCheck, keywords: "safety privacy protection", group: "Technology" },

  // Hobbies
  { name: "gamepad-2", label: "Games", icon: Gamepad2, keywords: "hobby play gaming", group: "Hobbies" },
  { name: "music", label: "Music", icon: Music, keywords: "hobby audio listening", group: "Hobbies" },
  { name: "guitar", label: "Guitar", icon: Guitar, keywords: "music instrument hobby", group: "Hobbies" },
  { name: "headphones", label: "Listening", icon: Headphones, keywords: "music podcast audio", group: "Hobbies" },
  { name: "palette", label: "Creative", icon: Palette, keywords: "art hobby design paint", group: "Hobbies" },
  { name: "brush", label: "Painting", icon: Brush, keywords: "art hobby creative", group: "Hobbies" },
  { name: "camera", label: "Photography", icon: Camera, keywords: "photo hobby camera", group: "Hobbies" },
  { name: "video", label: "Video", icon: Video, keywords: "filming hobby content", group: "Hobbies" },
  { name: "film", label: "Films", icon: Film, keywords: "cinema movies hobby", group: "Hobbies" },
  { name: "tv", label: "TV", icon: Tv, keywords: "watching series hobby", group: "Hobbies" },
  { name: "puzzle", label: "Puzzles", icon: Puzzle, keywords: "hobby games thinking", group: "Hobbies" },
  { name: "blocks", label: "Building", icon: Blocks, keywords: "hobby making play", group: "Hobbies" },
  { name: "party-popper", label: "Celebration", icon: PartyPopper, keywords: "party event milestone", group: "Hobbies" },

  // People
  { name: "users", label: "People", icon: Users, keywords: "family team community friends", group: "People" },
  { name: "baby", label: "Children", icon: Baby, keywords: "family child kids", group: "People" },
  { name: "hand-heart", label: "Care", icon: HandHeart, keywords: "family support charity", group: "People" },

  // Nature
  { name: "trees", label: "Outdoors", icon: Trees, keywords: "nature hobby park", group: "Nature" },
  { name: "leaf", label: "Plants", icon: Leaf, keywords: "nature green garden", group: "Nature" },
  { name: "flower-2", label: "Flowers", icon: Flower2, keywords: "garden nature", group: "Nature" },
  { name: "mountain", label: "Mountains", icon: Mountain, keywords: "hiking nature outdoors", group: "Nature" },
  { name: "wind", label: "Wind", icon: Wind, keywords: "weather air nature", group: "Nature" },
  { name: "sun", label: "Sun", icon: Sun, keywords: "day weather dhuhr", group: "Nature" },
  { name: "sunrise", label: "Sunrise", icon: Sunrise, keywords: "fajr morning dawn prayer", group: "Nature" },
  { name: "moon", label: "Moon", icon: Moon, keywords: "night isha prayer ramadan", group: "Nature" },
  { name: "star", label: "Star", icon: Star, keywords: "favourite night prayer", group: "Nature" },
  { name: "bird", label: "Birds", icon: Bird, keywords: "nature animals", group: "Nature" },
  { name: "dog", label: "Dog", icon: Dog, keywords: "pet animals", group: "Nature" },
  { name: "paw-print", label: "Pets", icon: PawPrint, keywords: "pet animals cat dog", group: "Nature" },
  { name: "feather", label: "Feather", icon: Feather, keywords: "light nature writing", group: "Nature" },

  // General
  { name: "sparkles", label: "Growth", icon: Sparkles, keywords: "capability improvement shine", group: "General" },
  { name: "infinity", label: "Ongoing", icon: InfinityIcon, keywords: "always continuous habit", group: "General" },
  { name: "circle", label: "Plain", icon: Circle, keywords: "default neutral simple", group: "General" },
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
  icon?: string | null | undefined;
  color?: string | null | undefined;
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

const GROUP_ORDER = [
  "Work",
  "Money",
  "Home",
  "Shopping",
  "Health",
  "Fitness",
  "Food",
  "Travel",
  "Learning",
  "Technology",
  "Hobbies",
  "People",
  "Nature",
  "General",
];

export function EntityIdentityPicker({
  value,
  onChange,
}: {
  value: EntityIdentityValue;
  onChange: (value: EntityIdentityValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = ICONS.find((item) => item.name === value.icon);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = term
      ? ICONS.filter((item) =>
          `${item.label} ${item.keywords} ${item.group} ${item.name}`.toLowerCase().includes(term),
        )
      : ICONS;
    return GROUP_ORDER.map((group) => ({
      group,
      items: matches.filter((item) => item.group === group),
    })).filter((entry) => entry.items.length > 0);
  }, [search]);

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-2">
        <Label>Icon</Label>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full min-w-0 justify-start"
          onClick={() => {
            setSearch("");
            setOpen(true);
          }}
        >
          <EntityIcon icon={value.icon} color={value.color} containerClassName="size-7 border-0 bg-transparent" />
          <span className="truncate">{selected?.label ?? "Choose an icon"}</span>
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Choose an icon</DialogTitle>
              <DialogDescription>Search by name or scroll through the groups.</DialogDescription>
            </DialogHeader>

            <Input
              autoFocus
              placeholder="Search icons…"
              aria-label="Search icons"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12"
            />

            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain">
              {groups.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No matching icon.</p>
              ) : (
                <div className="space-y-4 pb-2">
                  {groups.map((entry) => (
                    <div key={entry.group}>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {entry.group}
                      </p>
                      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                        {entry.items.map((item) => {
                          const Icon = item.icon;
                          const isSelected = value.icon === item.name;
                          return (
                            <button
                              key={item.name}
                              type="button"
                              title={item.label}
                              aria-label={item.label}
                              aria-pressed={isSelected}
                              onClick={() => {
                                onChange({ ...value, icon: item.name });
                                setOpen(false);
                              }}
                              className={cn(
                                "grid aspect-square min-h-11 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                                isSelected && "border-primary text-foreground ring-2 ring-primary",
                              )}
                            >
                              <Icon className="size-5" aria-hidden="true" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onChange({ ...value, icon: null });
                  setOpen(false);
                }}
              >
                Clear icon
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
