import { EntityIcon } from "@/components/app/EntityIdentity";
import type { Food } from "@/data/food";

/** Words in a food's name and the picture that fits them, first match wins. */
const PICTURES: [RegExp, string][] = [
  [/egg|بيض/i, "egg"],
  [/chicken|turkey|wing|thigh|drumstick|فراخ|دجاج|ديك/i, "drumstick"],
  [/fish|tuna|salmon|sardine|shrimp|سمك|تونة|جمبري/i, "fish"],
  [/beef|steak|mince|kofta|meat|lamb|liver|burger|لحم|كفتة|كبدة/i, "beef"],
  [/milk|yog|cheese|labneh|laban|لبن|زبادي|جبن/i, "milk"],
  [/coffee|tea|nescafe|قهوة|شاي/i, "coffee"],
  [/salad|lettuce|cucumber|tomato|vegetable|سلطة|خيار|طماطم|خضار/i, "salad"],
  [/soup|lentil|شوربة|عدس/i, "soup"],
  [/pizza|بيتزا/i, "pizza-slice"],
  [/sandwich|shawarma|wrap|ساندوتش|شاورما/i, "sandwich"],
  [/cake|dessert|basbousa|konafa|كيك|بسبوسة|كنافة/i, "cake"],
  [/cookie|biscuit|بسكويت/i, "cookie"],
  [/ice cream|ايس كريم/i, "ice-cream"],
  [/croissant|pastry|feteer|كرواسون|فطير/i, "croissant"],
  [/bread|toast|rice|pasta|oat|koshari|freekeh|عيش|خبز|رز|أرز|مكرونة|شوفان|كشري/i, "wheat"],
  [/grape|عنب/i, "grape"],
  [/carrot|جزر/i, "carrot"],
  [/apple|banana|orange|fruit|mango|\bdates?\b|تفاح|موز|برتقال|فاكهة|مانجو|بلح|تمر/i, "apple"],
  [/bean|\bfoul\b|\bful\b|fava|hummus|falafel|ta.?meya|فول|حمص|طعمية|فلافل/i, "leaf"],
];

/** The picture for a food: its own icon, or one that fits its name. */
function foodPicture(food: Pick<Food, "name" | "icon">): string {
  if (food.icon) return food.icon;
  return PICTURES.find(([pattern]) => pattern.test(food.name))?.[1] ?? "utensils";
}

/** A small picture beside a food in the plan and the log. */
export function FoodThumb({ food }: { food: Pick<Food, "name" | "icon"> }) {
  return <EntityIcon icon={foodPicture(food)} containerClassName="size-10" className="size-5" />;
}
