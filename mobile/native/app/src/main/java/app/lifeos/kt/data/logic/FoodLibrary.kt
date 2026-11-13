package app.lifeos.kt.data.logic

// Generated from the website's src/data/foodLibrary.ts: reference figures from public
// food composition tables (rounded), not measurements. Anything added from here is a
// normal food in the person's own library, which they can edit or delete.

data class LibraryFood(val name: String, val servingLabel: String, val servingGrams: Double?, val calories: Double, val proteinG: Double, val carbsG: Double, val fatG: Double, val group: String)

val FOOD_LIBRARY: List<LibraryFood> = listOf(
    LibraryFood("White rice, steamed", "100 g", 100.0, 130.0, 2.7, 28.0, 0.3, "Grains"),
    LibraryFood("Brown rice, steamed", "100 g", 100.0, 123.0, 2.7, 26.0, 1.0, "Grains"),
    LibraryFood("Pasta, boiled", "100 g", 100.0, 158.0, 5.8, 31.0, 0.9, "Grains"),
    LibraryFood("Baladi bread", "1 loaf (90 g)", 90.0, 250.0, 8.5, 51.0, 1.4, "Grains"),
    LibraryFood("Toast bread", "1 slice (30 g)", 30.0, 80.0, 2.7, 14.0, 1.0, "Grains"),
    LibraryFood("Oats, dry", "100 g", 100.0, 389.0, 17.0, 66.0, 7.0, "Grains"),
    LibraryFood("Koshari, plain", "300 g plate", 300.0, 450.0, 14.0, 83.0, 7.0, "Grains"),
    LibraryFood("Chicken breast, cooked", "100 g", 100.0, 165.0, 31.0, 0.0, 3.6, "Protein"),
    LibraryFood("Chicken thigh, cooked", "100 g", 100.0, 209.0, 26.0, 0.0, 11.0, "Protein"),
    LibraryFood("Beef mince, cooked", "100 g", 100.0, 250.0, 26.0, 0.0, 15.0, "Protein"),
    LibraryFood("Fish fillet, grilled", "100 g", 100.0, 145.0, 23.0, 0.0, 5.0, "Protein"),
    LibraryFood("Tuna, canned in water", "100 g", 100.0, 116.0, 26.0, 0.0, 1.0, "Protein"),
    LibraryFood("Egg, boiled", "1 large (50 g)", 50.0, 72.0, 6.3, 0.4, 5.0, "Protein"),
    LibraryFood("Ful medames", "100 g", 100.0, 110.0, 7.6, 19.0, 0.5, "Protein"),
    LibraryFood("Lentils, cooked", "100 g", 100.0, 116.0, 9.0, 20.0, 0.4, "Protein"),
    LibraryFood("Falafel (taameya), fried", "1 piece (25 g)", 25.0, 83.0, 3.3, 5.5, 5.5, "Protein"),
    LibraryFood("Milk, full fat", "100 ml", 100.0, 61.0, 3.2, 4.8, 3.3, "Dairy"),
    LibraryFood("Yoghurt, plain", "100 g", 100.0, 61.0, 3.5, 4.7, 3.3, "Dairy"),
    LibraryFood("White cheese", "30 g", 30.0, 80.0, 5.0, 1.0, 6.0, "Dairy"),
    LibraryFood("Roumy cheese", "30 g", 30.0, 117.0, 7.5, 0.4, 9.5, "Dairy"),
    LibraryFood("Banana", "1 medium (120 g)", 120.0, 107.0, 1.3, 27.0, 0.4, "Fruit and vegetables"),
    LibraryFood("Apple", "1 medium (180 g)", 180.0, 94.0, 0.5, 25.0, 0.3, "Fruit and vegetables"),
    LibraryFood("Orange", "1 medium (150 g)", 150.0, 71.0, 1.3, 18.0, 0.2, "Fruit and vegetables"),
    LibraryFood("Dates", "3 pieces (24 g)", 24.0, 68.0, 0.5, 18.0, 0.1, "Fruit and vegetables"),
    LibraryFood("Potato, boiled", "100 g", 100.0, 87.0, 2.0, 20.0, 0.1, "Fruit and vegetables"),
    LibraryFood("Mixed salad, no dressing", "100 g", 100.0, 20.0, 1.0, 4.0, 0.2, "Fruit and vegetables"),
    LibraryFood("Molokhia, cooked", "200 g bowl", 200.0, 120.0, 6.0, 10.0, 6.0, "Fruit and vegetables"),
    LibraryFood("Olive oil", "1 tablespoon (14 g)", 14.0, 124.0, 0.0, 0.0, 14.0, "Extras"),
    LibraryFood("Sugar", "1 teaspoon (4 g)", 4.0, 16.0, 0.0, 4.0, 0.0, "Extras"),
    LibraryFood("Peanut butter", "1 tablespoon (16 g)", 16.0, 94.0, 4.0, 3.0, 8.0, "Extras"),
    LibraryFood("Tea with sugar", "1 cup", null, 35.0, 0.0, 9.0, 0.0, "Extras"),
    LibraryFood("Coffee, black", "1 cup", null, 2.0, 0.2, 0.0, 0.0, "Extras"),
    LibraryFood("Soft drink", "330 ml can", 330.0, 139.0, 0.0, 35.0, 0.0, "Extras"),
    LibraryFood("Crisps", "30 g bag", 30.0, 160.0, 2.0, 15.0, 10.0, "Extras"),
    LibraryFood("Ful sandwich", "1 baladi sandwich", 150.0, 300.0, 12.0, 50.0, 6.0, "Sandwiches"),
    LibraryFood("Taameya sandwich", "1 baladi sandwich", 150.0, 350.0, 11.0, 45.0, 14.0, "Sandwiches"),
    LibraryFood("White cheese sandwich", "1 baladi sandwich", 140.0, 330.0, 15.0, 48.0, 9.0, "Sandwiches"),
    LibraryFood("Chicken shawarma sandwich", "1 sandwich", 200.0, 450.0, 25.0, 45.0, 18.0, "Sandwiches"),
    LibraryFood("Feteer meshaltet", "1 slice (100 g)", 100.0, 390.0, 7.0, 40.0, 23.0, "Egyptian dishes"),
    LibraryFood("Halawa", "30 g", 30.0, 160.0, 4.0, 15.0, 9.5, "Egyptian dishes"),
    LibraryFood("Mahshi", "200 g", 200.0, 290.0, 5.0, 45.0, 10.0, "Egyptian dishes"),
    LibraryFood("Kofta, grilled", "100 g", 100.0, 250.0, 18.0, 4.0, 18.0, "Egyptian dishes"),
    LibraryFood("Fattah", "300 g plate", 300.0, 550.0, 25.0, 60.0, 23.0, "Egyptian dishes"),
    LibraryFood("Rice with vermicelli", "100 g", 100.0, 150.0, 3.0, 28.0, 3.0, "Egyptian dishes"),
    LibraryFood("Hummus", "100 g", 100.0, 166.0, 8.0, 14.0, 10.0, "Egyptian dishes"),
    LibraryFood("Burger", "1 single burger", 150.0, 450.0, 25.0, 35.0, 23.0, "Takeaway"),
    LibraryFood("Pizza", "1 slice (100 g)", 100.0, 270.0, 11.0, 33.0, 10.0, "Takeaway"),
    LibraryFood("Chicken fried rice", "250 g", 250.0, 420.0, 18.0, 55.0, 14.0, "Takeaway"),
    LibraryFood("Sushi roll", "6 pieces", 150.0, 250.0, 9.0, 45.0, 4.0, "Takeaway"),
    LibraryFood("Mixed nuts", "30 g", 30.0, 180.0, 5.0, 6.0, 16.0, "Extras"),
)

/** Where each library food usually belongs: cuisines (none = everyday, offered to everyone) and meals. */
private val TAGS: Map<String, Pair<List<String>, List<String>>> = mapOf(
    "White rice, steamed" to (listOf<String>() to listOf("lunch", "dinner")),
    "Brown rice, steamed" to (listOf<String>() to listOf("lunch", "dinner")),
    "Pasta, boiled" to (listOf<String>("western") to listOf("lunch", "dinner")),
    "Baladi bread" to (listOf<String>("egyptian") to listOf("breakfast", "lunch", "dinner")),
    "Toast bread" to (listOf<String>() to listOf("breakfast")),
    "Oats, dry" to (listOf<String>("western") to listOf("breakfast")),
    "Koshari, plain" to (listOf<String>("egyptian") to listOf("lunch", "dinner")),
    "Chicken breast, cooked" to (listOf<String>() to listOf("lunch", "dinner")),
    "Chicken thigh, cooked" to (listOf<String>() to listOf("lunch", "dinner")),
    "Beef mince, cooked" to (listOf<String>() to listOf("lunch", "dinner")),
    "Fish fillet, grilled" to (listOf<String>() to listOf("lunch", "dinner")),
    "Tuna, canned in water" to (listOf<String>() to listOf("lunch", "dinner", "snack")),
    "Egg, boiled" to (listOf<String>() to listOf("breakfast", "snack")),
    "Ful medames" to (listOf<String>("egyptian", "middle_eastern") to listOf("breakfast", "dinner")),
    "Lentils, cooked" to (listOf<String>("egyptian", "middle_eastern") to listOf("lunch", "dinner")),
    "Falafel (taameya), fried" to (listOf<String>("egyptian", "middle_eastern") to listOf("breakfast", "dinner")),
    "Milk, full fat" to (listOf<String>() to listOf("breakfast", "snack")),
    "Yoghurt, plain" to (listOf<String>() to listOf("breakfast", "snack")),
    "White cheese" to (listOf<String>("egyptian", "middle_eastern") to listOf("breakfast", "dinner")),
    "Roumy cheese" to (listOf<String>("egyptian") to listOf("breakfast", "dinner")),
    "Banana" to (listOf<String>() to listOf("breakfast", "snack")),
    "Apple" to (listOf<String>() to listOf("snack")),
    "Orange" to (listOf<String>() to listOf("snack")),
    "Dates" to (listOf<String>("egyptian", "middle_eastern") to listOf("snack", "breakfast")),
    "Potato, boiled" to (listOf<String>() to listOf("lunch", "dinner")),
    "Mixed salad, no dressing" to (listOf<String>() to listOf("lunch", "dinner")),
    "Molokhia, cooked" to (listOf<String>("egyptian") to listOf("lunch", "dinner")),
    "Olive oil" to (listOf<String>() to listOf("lunch", "dinner")),
    "Sugar" to (listOf<String>() to listOf("breakfast", "snack")),
    "Peanut butter" to (listOf<String>("western") to listOf("breakfast", "snack")),
    "Tea with sugar" to (listOf<String>() to listOf("breakfast", "snack")),
    "Coffee, black" to (listOf<String>() to listOf("breakfast", "snack")),
    "Soft drink" to (listOf<String>() to listOf("lunch", "dinner", "snack")),
    "Crisps" to (listOf<String>() to listOf("snack")),
    "Ful sandwich" to (listOf<String>("egyptian") to listOf("breakfast")),
    "Taameya sandwich" to (listOf<String>("egyptian") to listOf("breakfast")),
    "White cheese sandwich" to (listOf<String>("egyptian") to listOf("breakfast", "dinner")),
    "Chicken shawarma sandwich" to (listOf<String>("egyptian", "middle_eastern") to listOf("lunch", "dinner")),
    "Feteer meshaltet" to (listOf<String>("egyptian") to listOf("breakfast", "dinner")),
    "Halawa" to (listOf<String>("egyptian", "middle_eastern") to listOf("breakfast", "dinner")),
    "Mahshi" to (listOf<String>("egyptian", "middle_eastern") to listOf("lunch", "dinner")),
    "Kofta, grilled" to (listOf<String>("egyptian", "middle_eastern") to listOf("lunch", "dinner")),
    "Fattah" to (listOf<String>("egyptian") to listOf("lunch")),
    "Rice with vermicelli" to (listOf<String>("egyptian") to listOf("lunch", "dinner")),
    "Hummus" to (listOf<String>("middle_eastern") to listOf("lunch", "dinner", "snack")),
    "Burger" to (listOf<String>("western") to listOf("lunch", "dinner")),
    "Pizza" to (listOf<String>("western") to listOf("lunch", "dinner")),
    "Chicken fried rice" to (listOf<String>("asian") to listOf("lunch", "dinner")),
    "Sushi roll" to (listOf<String>("asian") to listOf("lunch", "dinner")),
    "Mixed nuts" to (listOf<String>() to listOf("snack")),
)

val CUISINES = listOf("egyptian" to "Egyptian", "middle_eastern" to "Middle Eastern", "western" to "Western", "asian" to "Asian")

/** Library foods typical at a meal for the chosen cuisines; everyday foods always count. Cuisine dishes first. */
fun suggestionsFor(meal: String, cuisines: List<String>): List<LibraryFood> = FOOD_LIBRARY
    .filter { food ->
        val (foodCuisines, meals) = TAGS[food.name] ?: return@filter false
        meal in meals && (foodCuisines.isEmpty() || foodCuisines.any { it in cuisines })
    }
    .sortedBy { if (TAGS[it.name]?.first.isNullOrEmpty()) 1 else 0 }

/** Library entries not already in the person's own library, matched by name. */
fun libraryNotYetAdded(existing: List<String>): List<LibraryFood> {
    val have = existing.map { it.trim().lowercase() }.toSet()
    return FOOD_LIBRARY.filter { it.name.lowercase() !in have }
}
