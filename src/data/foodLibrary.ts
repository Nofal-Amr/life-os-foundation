import type { FoodInput } from "./food";

/**
 * A starter list of everyday foods with typical values, so a food library
 * doesn't have to be typed from scratch.
 *
 * These are **reference figures** from public food composition tables
 * (rounded), not measurements of your food: portions, recipes and brands
 * vary. Anything added from here is a normal entry in your library that you
 * can edit or delete.
 */

export type LibraryFood = {
  name: string;
  /** What the figures describe, e.g. "100 g" or "1 large egg". */
  serving_label: string;
  serving_grams: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  group: string;
};

export const FOOD_LIBRARY: LibraryFood[] = [
  // Grains and bread
  { name: "White rice, steamed", serving_label: "100 g", serving_grams: 100, calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, group: "Grains" },
  { name: "Brown rice, steamed", serving_label: "100 g", serving_grams: 100, calories: 123, protein_g: 2.7, carbs_g: 26, fat_g: 1, group: "Grains" },
  { name: "Pasta, boiled", serving_label: "100 g", serving_grams: 100, calories: 158, protein_g: 5.8, carbs_g: 31, fat_g: 0.9, group: "Grains" },
  { name: "Baladi bread", serving_label: "1 loaf (90 g)", serving_grams: 90, calories: 250, protein_g: 8.5, carbs_g: 51, fat_g: 1.4, group: "Grains" },
  { name: "Toast bread", serving_label: "1 slice (30 g)", serving_grams: 30, calories: 80, protein_g: 2.7, carbs_g: 14, fat_g: 1, group: "Grains" },
  { name: "Oats, dry", serving_label: "100 g", serving_grams: 100, calories: 389, protein_g: 17, carbs_g: 66, fat_g: 7, group: "Grains" },
  { name: "Koshari, plain", serving_label: "300 g plate", serving_grams: 300, calories: 450, protein_g: 14, carbs_g: 83, fat_g: 7, group: "Grains" },

  // Protein
  { name: "Chicken breast, cooked", serving_label: "100 g", serving_grams: 100, calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, group: "Protein" },
  { name: "Chicken thigh, cooked", serving_label: "100 g", serving_grams: 100, calories: 209, protein_g: 26, carbs_g: 0, fat_g: 11, group: "Protein" },
  { name: "Beef mince, cooked", serving_label: "100 g", serving_grams: 100, calories: 250, protein_g: 26, carbs_g: 0, fat_g: 15, group: "Protein" },
  { name: "Fish fillet, grilled", serving_label: "100 g", serving_grams: 100, calories: 145, protein_g: 23, carbs_g: 0, fat_g: 5, group: "Protein" },
  { name: "Tuna, canned in water", serving_label: "100 g", serving_grams: 100, calories: 116, protein_g: 26, carbs_g: 0, fat_g: 1, group: "Protein" },
  { name: "Egg, boiled", serving_label: "1 large (50 g)", serving_grams: 50, calories: 72, protein_g: 6.3, carbs_g: 0.4, fat_g: 5, group: "Protein" },
  { name: "Ful medames", serving_label: "100 g", serving_grams: 100, calories: 110, protein_g: 7.6, carbs_g: 19, fat_g: 0.5, group: "Protein" },
  { name: "Lentils, cooked", serving_label: "100 g", serving_grams: 100, calories: 116, protein_g: 9, carbs_g: 20, fat_g: 0.4, group: "Protein" },
  { name: "Falafel (taameya), fried", serving_label: "1 piece (25 g)", serving_grams: 25, calories: 83, protein_g: 3.3, carbs_g: 5.5, fat_g: 5.5, group: "Protein" },

  // Dairy
  { name: "Milk, full fat", serving_label: "100 ml", serving_grams: 100, calories: 61, protein_g: 3.2, carbs_g: 4.8, fat_g: 3.3, group: "Dairy" },
  { name: "Yoghurt, plain", serving_label: "100 g", serving_grams: 100, calories: 61, protein_g: 3.5, carbs_g: 4.7, fat_g: 3.3, group: "Dairy" },
  { name: "White cheese", serving_label: "30 g", serving_grams: 30, calories: 80, protein_g: 5, carbs_g: 1, fat_g: 6, group: "Dairy" },
  { name: "Roumy cheese", serving_label: "30 g", serving_grams: 30, calories: 117, protein_g: 7.5, carbs_g: 0.4, fat_g: 9.5, group: "Dairy" },

  // Fruit and vegetables
  { name: "Banana", serving_label: "1 medium (120 g)", serving_grams: 120, calories: 107, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, group: "Fruit and vegetables" },
  { name: "Apple", serving_label: "1 medium (180 g)", serving_grams: 180, calories: 94, protein_g: 0.5, carbs_g: 25, fat_g: 0.3, group: "Fruit and vegetables" },
  { name: "Orange", serving_label: "1 medium (150 g)", serving_grams: 150, calories: 71, protein_g: 1.3, carbs_g: 18, fat_g: 0.2, group: "Fruit and vegetables" },
  { name: "Dates", serving_label: "3 pieces (24 g)", serving_grams: 24, calories: 68, protein_g: 0.5, carbs_g: 18, fat_g: 0.1, group: "Fruit and vegetables" },
  { name: "Potato, boiled", serving_label: "100 g", serving_grams: 100, calories: 87, protein_g: 2, carbs_g: 20, fat_g: 0.1, group: "Fruit and vegetables" },
  { name: "Mixed salad, no dressing", serving_label: "100 g", serving_grams: 100, calories: 20, protein_g: 1, carbs_g: 4, fat_g: 0.2, group: "Fruit and vegetables" },
  { name: "Molokhia, cooked", serving_label: "200 g bowl", serving_grams: 200, calories: 120, protein_g: 6, carbs_g: 10, fat_g: 6, group: "Fruit and vegetables" },

  // Snacks, drinks and extras
  { name: "Olive oil", serving_label: "1 tablespoon (14 g)", serving_grams: 14, calories: 124, protein_g: 0, carbs_g: 0, fat_g: 14, group: "Extras" },
  { name: "Sugar", serving_label: "1 teaspoon (4 g)", serving_grams: 4, calories: 16, protein_g: 0, carbs_g: 4, fat_g: 0, group: "Extras" },
  { name: "Peanut butter", serving_label: "1 tablespoon (16 g)", serving_grams: 16, calories: 94, protein_g: 4, carbs_g: 3, fat_g: 8, group: "Extras" },
  { name: "Tea with sugar", serving_label: "1 cup", serving_grams: null, calories: 35, protein_g: 0, carbs_g: 9, fat_g: 0, group: "Extras" },
  { name: "Coffee, black", serving_label: "1 cup", serving_grams: null, calories: 2, protein_g: 0.2, carbs_g: 0, fat_g: 0, group: "Extras" },
  { name: "Soft drink", serving_label: "330 ml can", serving_grams: 330, calories: 139, protein_g: 0, carbs_g: 35, fat_g: 0, group: "Extras" },
  { name: "Crisps", serving_label: "30 g bag", serving_grams: 30, calories: 160, protein_g: 2, carbs_g: 15, fat_g: 10, group: "Extras" },

  // Egyptian favourites
  { name: "Ful sandwich", serving_label: "1 baladi sandwich", serving_grams: 150, calories: 300, protein_g: 12, carbs_g: 50, fat_g: 6, group: "Sandwiches" },
  { name: "Taameya sandwich", serving_label: "1 baladi sandwich", serving_grams: 150, calories: 350, protein_g: 11, carbs_g: 45, fat_g: 14, group: "Sandwiches" },
  { name: "White cheese sandwich", serving_label: "1 baladi sandwich", serving_grams: 140, calories: 330, protein_g: 15, carbs_g: 48, fat_g: 9, group: "Sandwiches" },
  { name: "Chicken shawarma sandwich", serving_label: "1 sandwich", serving_grams: 200, calories: 450, protein_g: 25, carbs_g: 45, fat_g: 18, group: "Sandwiches" },
  { name: "Feteer meshaltet", serving_label: "1 slice (100 g)", serving_grams: 100, calories: 390, protein_g: 7, carbs_g: 40, fat_g: 23, group: "Egyptian dishes" },
  { name: "Halawa", serving_label: "30 g", serving_grams: 30, calories: 160, protein_g: 4, carbs_g: 15, fat_g: 9.5, group: "Egyptian dishes" },
  { name: "Mahshi", serving_label: "200 g", serving_grams: 200, calories: 290, protein_g: 5, carbs_g: 45, fat_g: 10, group: "Egyptian dishes" },
  { name: "Kofta, grilled", serving_label: "100 g", serving_grams: 100, calories: 250, protein_g: 18, carbs_g: 4, fat_g: 18, group: "Egyptian dishes" },
  { name: "Fattah", serving_label: "300 g plate", serving_grams: 300, calories: 550, protein_g: 25, carbs_g: 60, fat_g: 23, group: "Egyptian dishes" },
  { name: "Rice with vermicelli", serving_label: "100 g", serving_grams: 100, calories: 150, protein_g: 3, carbs_g: 28, fat_g: 3, group: "Egyptian dishes" },
  { name: "Hummus", serving_label: "100 g", serving_grams: 100, calories: 166, protein_g: 8, carbs_g: 14, fat_g: 10, group: "Egyptian dishes" },

  // Takeaway
  { name: "Burger", serving_label: "1 single burger", serving_grams: 150, calories: 450, protein_g: 25, carbs_g: 35, fat_g: 23, group: "Takeaway" },
  { name: "Pizza", serving_label: "1 slice (100 g)", serving_grams: 100, calories: 270, protein_g: 11, carbs_g: 33, fat_g: 10, group: "Takeaway" },
  { name: "Chicken fried rice", serving_label: "250 g", serving_grams: 250, calories: 420, protein_g: 18, carbs_g: 55, fat_g: 14, group: "Takeaway" },
  { name: "Sushi roll", serving_label: "6 pieces", serving_grams: 150, calories: 250, protein_g: 9, carbs_g: 45, fat_g: 4, group: "Takeaway" },
  { name: "Mixed nuts", serving_label: "30 g", serving_grams: 30, calories: 180, protein_g: 5, carbs_g: 6, fat_g: 16, group: "Extras" },
];

export const FOOD_LIBRARY_GROUPS = [...new Set(FOOD_LIBRARY.map((food) => food.group))];

/** A library entry as a new food in your own library. */
export function toFoodInput(food: LibraryFood): FoodInput {
  return {
    name: food.name,
    serving_label: food.serving_label,
    serving_grams: food.serving_grams,
    calories: food.calories,
    protein_g: food.protein_g,
    carbs_g: food.carbs_g,
    fat_g: food.fat_g,
    icon: null,
  };
}

/** Library entries not already in your library, matched by name. */
export function libraryNotYetAdded(existing: { name: string }[]): LibraryFood[] {
  const have = new Set(existing.map((food) => food.name.trim().toLowerCase()));
  return FOOD_LIBRARY.filter((food) => !have.has(food.name.toLowerCase()));
}

export type Cuisine = "egyptian" | "middle_eastern" | "western" | "asian";
export type LibraryMeal = "breakfast" | "lunch" | "dinner" | "snack";

export const CUISINES: { value: Cuisine; label: string }[] = [
  { value: "egyptian", label: "Egyptian" },
  { value: "middle_eastern", label: "Middle Eastern" },
  { value: "western", label: "Western" },
  { value: "asian", label: "Asian" },
];

/**
 * Where each library food usually belongs: its cuisines (none means an
 * everyday food, offered to everyone) and the meals it is typical at.
 */
const TAGS: Record<string, { cuisines?: Cuisine[]; meals: LibraryMeal[] }> = {
  "White rice, steamed": { meals: ["lunch","dinner"] },
  "Brown rice, steamed": { meals: ["lunch","dinner"] },
  "Pasta, boiled": { cuisines: ["western"], meals: ["lunch","dinner"] },
  "Baladi bread": { cuisines: ["egyptian"], meals: ["breakfast","lunch","dinner"] },
  "Toast bread": { meals: ["breakfast"] },
  "Oats, dry": { cuisines: ["western"], meals: ["breakfast"] },
  "Koshari, plain": { cuisines: ["egyptian"], meals: ["lunch","dinner"] },
  "Chicken breast, cooked": { meals: ["lunch","dinner"] },
  "Chicken thigh, cooked": { meals: ["lunch","dinner"] },
  "Beef mince, cooked": { meals: ["lunch","dinner"] },
  "Fish fillet, grilled": { meals: ["lunch","dinner"] },
  "Tuna, canned in water": { meals: ["lunch","dinner","snack"] },
  "Egg, boiled": { meals: ["breakfast","snack"] },
  "Ful medames": { cuisines: ["egyptian","middle_eastern"], meals: ["breakfast","dinner"] },
  "Lentils, cooked": { cuisines: ["egyptian","middle_eastern"], meals: ["lunch","dinner"] },
  "Falafel (taameya), fried": { cuisines: ["egyptian","middle_eastern"], meals: ["breakfast","dinner"] },
  "Milk, full fat": { meals: ["breakfast","snack"] },
  "Yoghurt, plain": { meals: ["breakfast","snack"] },
  "White cheese": { cuisines: ["egyptian","middle_eastern"], meals: ["breakfast","dinner"] },
  "Roumy cheese": { cuisines: ["egyptian"], meals: ["breakfast","dinner"] },
  "Banana": { meals: ["breakfast","snack"] },
  "Apple": { meals: ["snack"] },
  "Orange": { meals: ["snack"] },
  "Dates": { cuisines: ["egyptian","middle_eastern"], meals: ["snack","breakfast"] },
  "Potato, boiled": { meals: ["lunch","dinner"] },
  "Mixed salad, no dressing": { meals: ["lunch","dinner"] },
  "Molokhia, cooked": { cuisines: ["egyptian"], meals: ["lunch","dinner"] },
  "Olive oil": { meals: ["lunch","dinner"] },
  "Sugar": { meals: ["breakfast","snack"] },
  "Peanut butter": { cuisines: ["western"], meals: ["breakfast","snack"] },
  "Tea with sugar": { meals: ["breakfast","snack"] },
  "Coffee, black": { meals: ["breakfast","snack"] },
  "Soft drink": { meals: ["lunch","dinner","snack"] },
  "Crisps": { meals: ["snack"] },
  "Ful sandwich": { cuisines: ["egyptian"], meals: ["breakfast"] },
  "Taameya sandwich": { cuisines: ["egyptian"], meals: ["breakfast"] },
  "White cheese sandwich": { cuisines: ["egyptian"], meals: ["breakfast","dinner"] },
  "Chicken shawarma sandwich": { cuisines: ["egyptian","middle_eastern"], meals: ["lunch","dinner"] },
  "Feteer meshaltet": { cuisines: ["egyptian"], meals: ["breakfast","dinner"] },
  "Halawa": { cuisines: ["egyptian","middle_eastern"], meals: ["breakfast","dinner"] },
  "Mahshi": { cuisines: ["egyptian","middle_eastern"], meals: ["lunch","dinner"] },
  "Kofta, grilled": { cuisines: ["egyptian","middle_eastern"], meals: ["lunch","dinner"] },
  "Fattah": { cuisines: ["egyptian"], meals: ["lunch"] },
  "Rice with vermicelli": { cuisines: ["egyptian"], meals: ["lunch","dinner"] },
  "Hummus": { cuisines: ["middle_eastern"], meals: ["lunch","dinner","snack"] },
  "Burger": { cuisines: ["western"], meals: ["lunch","dinner"] },
  "Pizza": { cuisines: ["western"], meals: ["lunch","dinner"] },
  "Chicken fried rice": { cuisines: ["asian"], meals: ["lunch","dinner"] },
  "Sushi roll": { cuisines: ["asian"], meals: ["lunch","dinner"] },
  "Mixed nuts": { meals: ["snack"] },
};

/** Library foods typical at a meal for the cuisines you picked; everyday foods always count. */
export function suggestionsFor(meal: LibraryMeal, cuisines: Cuisine[]): LibraryFood[] {
  const matches = FOOD_LIBRARY.filter((food) => {
    const tag = TAGS[food.name];
    if (!tag || !tag.meals.includes(meal)) return false;
    return !tag.cuisines?.length || tag.cuisines.some((cuisine) => cuisines.includes(cuisine));
  });
  // Dishes from your cuisines first, then the everyday basics.
  const specific = (food: LibraryFood) => (TAGS[food.name]?.cuisines?.length ? 0 : 1);
  return matches
    .map((food, index) => ({ food, index }))
    .sort((a, b) => specific(a.food) - specific(b.food) || a.index - b.index)
    .map(({ food }) => food);
}

/** Library foods without tags; kept empty so suggestions never miss one. */
export function untaggedFoods(): string[] {
  return FOOD_LIBRARY.filter((food) => !TAGS[food.name]).map((food) => food.name);
}
