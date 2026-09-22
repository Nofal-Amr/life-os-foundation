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
