package app.lifeos.kt.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.automirrored.outlined.ShowChart
import androidx.compose.material.icons.automirrored.outlined.TrendingUp
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.automirrored.outlined.DirectionsWalk
import androidx.compose.material.icons.automirrored.outlined.DirectionsBike
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * The web's EntityIdentity: an icon name (lucide) and a colour token stored
 * on projects, goals, habits and capabilities, shown here with the nearest
 * native icon so something made on the website looks the same in the app.
 */
val IDENTITY_ICONS: Map<String, ImageVector> = mapOf(
    "briefcase-business" to Icons.Outlined.BusinessCenter, "briefcase" to Icons.Outlined.Work, "target" to Icons.Outlined.TrackChanges,
    "list-checks" to Icons.Outlined.Checklist, "clipboard-list" to Icons.Outlined.Assignment, "presentation" to Icons.Outlined.CoPresent,
    "handshake" to Icons.Outlined.Handshake, "megaphone" to Icons.Outlined.Campaign, "mail" to Icons.Outlined.Mail, "send" to Icons.AutoMirrored.Outlined.Send,
    "printer" to Icons.Outlined.Print, "folder" to Icons.Outlined.Folder, "calendar-days" to Icons.Outlined.CalendarMonth, "clock" to Icons.Outlined.Schedule,
    "timer" to Icons.Outlined.Timer, "alarm-clock" to Icons.Outlined.Alarm, "hourglass" to Icons.Outlined.HourglassEmpty, "settings-2" to Icons.Outlined.Settings,
    "wallet" to Icons.Outlined.AccountBalanceWallet, "banknote" to Icons.Outlined.Payments, "coins" to Icons.Outlined.Toll, "piggy-bank" to Icons.Outlined.Savings,
    "credit-card" to Icons.Outlined.CreditCard, "landmark" to Icons.Outlined.AccountBalance, "receipt" to Icons.Outlined.Receipt, "calculator" to Icons.Outlined.Calculate,
    "trending-up" to Icons.AutoMirrored.Outlined.TrendingUp, "candlestick-chart" to Icons.Outlined.CandlestickChart, "scale" to Icons.Outlined.Balance,
    "tag" to Icons.Outlined.Sell, "ticket" to Icons.Outlined.ConfirmationNumber, "gift" to Icons.Outlined.CardGiftcard, "home" to Icons.Outlined.Home,
    "building-2" to Icons.Outlined.Apartment, "door-open" to Icons.Outlined.DoorFront, "key" to Icons.Outlined.Key, "zap" to Icons.Outlined.Bolt,
    "plug" to Icons.Outlined.Power, "lightbulb" to Icons.Outlined.Lightbulb, "battery-charging" to Icons.Outlined.BatteryChargingFull,
    "droplet" to Icons.Outlined.WaterDrop, "shower" to Icons.Outlined.Shower, "flame" to Icons.Outlined.LocalFireDepartment, "thermometer" to Icons.Outlined.Thermostat,
    "air-vent" to Icons.Outlined.Air, "fan" to Icons.Outlined.Air, "snowflake" to Icons.Outlined.AcUnit, "refrigerator" to Icons.Outlined.Kitchen,
    "sofa" to Icons.Outlined.Weekend, "armchair" to Icons.Outlined.Chair, "bed" to Icons.Outlined.Bed, "lamp" to Icons.Outlined.Light, "table" to Icons.Outlined.TableRestaurant,
    "wallpaper" to Icons.Outlined.Wallpaper, "paint-roller" to Icons.Outlined.FormatPaint, "hammer" to Icons.Outlined.Hardware, "wrench" to Icons.Outlined.Build,
    "recycle" to Icons.Outlined.Recycling, "box" to Icons.Outlined.Inventory2, "shopping-basket" to Icons.Outlined.ShoppingBasket, "shopping-cart" to Icons.Outlined.ShoppingCart,
    "shopping-bag" to Icons.Outlined.ShoppingBag, "store" to Icons.Outlined.Store, "package" to Icons.Outlined.Inventory, "truck" to Icons.Outlined.LocalShipping,
    "shirt" to Icons.Outlined.Checkroom, "glasses" to Icons.Outlined.Visibility, "watch" to Icons.Outlined.Watch, "scissors" to Icons.Outlined.ContentCut,
    "heart-pulse" to Icons.Outlined.MonitorHeart, "heart" to Icons.Outlined.FavoriteBorder, "pill" to Icons.Outlined.Medication, "syringe" to Icons.Outlined.Vaccines,
    "stethoscope" to Icons.Outlined.MedicalServices, "hospital" to Icons.Outlined.LocalHospital, "microscope" to Icons.Outlined.Biotech, "flask-conical" to Icons.Outlined.Science,
    "bone" to Icons.Outlined.Healing, "brain-cog" to Icons.Outlined.Psychology, "activity" to Icons.AutoMirrored.Outlined.ShowChart, "life-buoy" to Icons.Outlined.Support,
    "cigarette" to Icons.Outlined.SmokingRooms, "dumbbell" to Icons.Outlined.FitnessCenter, "bike" to Icons.AutoMirrored.Outlined.DirectionsBike,
    "footprints" to Icons.AutoMirrored.Outlined.DirectionsWalk, "person-standing" to Icons.Outlined.Accessibility, "waves" to Icons.Outlined.Waves,
    "trophy" to Icons.Outlined.EmojiEvents, "medal" to Icons.Outlined.MilitaryTech, "award" to Icons.Outlined.WorkspacePremium, "ruler" to Icons.Outlined.Straighten,
    "salad" to Icons.Outlined.RiceBowl, "utensils" to Icons.Outlined.Restaurant, "chef-hat" to Icons.Outlined.OutdoorGrill, "soup" to Icons.Outlined.SoupKitchen,
    "beef" to Icons.Outlined.LunchDining, "drumstick" to Icons.Outlined.LunchDining, "fish" to Icons.Outlined.SetMeal, "egg" to Icons.Outlined.EggAlt,
    "milk" to Icons.Outlined.LocalDrink, "wheat" to Icons.Outlined.Grass, "sandwich" to Icons.Outlined.LunchDining, "pizza-slice" to Icons.Outlined.LocalPizza,
    "apple" to Icons.Outlined.Eco, "grape" to Icons.Outlined.Eco, "carrot" to Icons.Outlined.Eco, "cookie" to Icons.Outlined.Cookie, "cake" to Icons.Outlined.Cake,
    "ice-cream" to Icons.Outlined.Icecream, "croissant" to Icons.Outlined.BakeryDining, "coffee" to Icons.Outlined.Coffee, "plane" to Icons.Outlined.Flight,
    "plane-takeoff" to Icons.Outlined.FlightTakeoff, "plane-landing" to Icons.Outlined.FlightLand, "tickets-plane" to Icons.Outlined.AirplaneTicket, "hotel" to Icons.Outlined.Hotel,
    "car-taxi" to Icons.Outlined.LocalTaxi, "caravan" to Icons.Outlined.RvHookup, "sailboat" to Icons.Outlined.Sailing, "car" to Icons.Outlined.DirectionsCar,
    "fuel" to Icons.Outlined.LocalGasStation, "bus" to Icons.Outlined.DirectionsBus, "train" to Icons.Outlined.Train, "ship" to Icons.Outlined.DirectionsBoat,
    "luggage" to Icons.Outlined.Luggage, "map" to Icons.Outlined.Map, "map-pinned" to Icons.Outlined.LocationOn, "compass" to Icons.Outlined.Explore, "globe" to Icons.Outlined.Public,
    "tent" to Icons.Outlined.Cabin, "anchor" to Icons.Outlined.Anchor, "umbrella" to Icons.Outlined.Umbrella, "graduation-cap" to Icons.Outlined.School,
    "book-open" to Icons.AutoMirrored.Outlined.MenuBook, "book-marked" to Icons.Outlined.BookmarkBorder, "library" to Icons.Outlined.LocalLibrary, "school" to Icons.Outlined.School,
    "notebook" to Icons.Outlined.Book, "pen-tool" to Icons.Outlined.Draw, "newspaper" to Icons.Outlined.Newspaper, "backpack" to Icons.Outlined.Backpack,
    "laptop" to Icons.Outlined.Laptop, "monitor" to Icons.Outlined.Monitor, "code-2" to Icons.Outlined.Code, "cpu" to Icons.Outlined.Memory, "database" to Icons.Outlined.Storage,
    "hard-drive" to Icons.Outlined.Storage, "wifi" to Icons.Outlined.Wifi, "signal" to Icons.Outlined.SignalCellularAlt, "smartphone" to Icons.Outlined.Smartphone,
    "phone" to Icons.Outlined.Phone, "gauge" to Icons.Outlined.Speed, "bot" to Icons.Outlined.SmartToy, "mouse-pointer-2" to Icons.Outlined.Mouse, "cloud" to Icons.Outlined.Cloud,
    "shield-check" to Icons.Outlined.VerifiedUser, "gamepad-2" to Icons.Outlined.SportsEsports, "music" to Icons.Outlined.MusicNote, "guitar" to Icons.Outlined.MusicNote,
    "headphones" to Icons.Outlined.Headphones, "palette" to Icons.Outlined.Palette, "brush" to Icons.Outlined.Brush, "camera" to Icons.Outlined.PhotoCamera,
    "video" to Icons.Outlined.Videocam, "film" to Icons.Outlined.Movie, "tv" to Icons.Outlined.Tv, "puzzle" to Icons.Outlined.Extension, "blocks" to Icons.Outlined.Widgets,
    "party-popper" to Icons.Outlined.Celebration, "users" to Icons.Outlined.Groups, "baby" to Icons.Outlined.ChildCare, "hand-heart" to Icons.Outlined.VolunteerActivism,
    "trees" to Icons.Outlined.Forest, "leaf" to Icons.Outlined.Eco, "flower-2" to Icons.Outlined.LocalFlorist, "mountain" to Icons.Outlined.Landscape, "wind" to Icons.Outlined.Air,
    "sun" to Icons.Outlined.WbSunny, "sunrise" to Icons.Outlined.WbTwilight, "moon" to Icons.Outlined.DarkMode, "star" to Icons.Outlined.StarOutline, "bird" to Icons.Outlined.FlutterDash,
    "dog" to Icons.Outlined.Pets, "paw-print" to Icons.Outlined.Pets, "feather" to Icons.Outlined.Air, "sparkles" to Icons.Outlined.AutoAwesome, "infinity" to Icons.Outlined.AllInclusive,
    "circle" to Icons.Outlined.Circle,
)

/** A small set to choose from in the app; anything else stays as it was set on the web. */
val PICKER_ICONS = listOf(
    "briefcase", "target", "home", "wallet", "heart-pulse", "dumbbell", "footprints", "book-open", "graduation-cap", "moon",
    "users", "car", "plane", "utensils", "code-2", "palette", "music", "leaf", "star", "sparkles",
)

/** The eight identity colours, by the web's names. */
val IDENTITY_COLORS = listOf("blue", "teal", "green", "amber", "coral", "rose", "violet", "slate")

/** A stored colour: "var(--entity-blue)", "blue", "chart-2" or "#hex"; null when unset. */
@Composable
fun identityColor(stored: String?): Color? {
    if (stored.isNullOrBlank()) return null
    val colors = LifeTheme.colors
    val name = stored.removePrefix("var(--entity-").removePrefix("var(--").removeSuffix(")").removePrefix("entity-")
    colors.entity[name]?.let { return it }
    Regex("chart-(\\d)").find(name)?.let { m -> colors.chart.getOrNull(m.groupValues[1].toInt() - 1)?.let { return it } }
    return runCatching { Color(android.graphics.Color.parseColor(stored)) }.getOrNull()
}

fun identityIcon(stored: String?): ImageVector = IDENTITY_ICONS[stored] ?: Icons.Outlined.Circle

/** The icon in a softly tinted square, as the web's EntityIcon. */
@Composable
fun EntityIcon(icon: String?, color: String?, fallback: ImageVector = Icons.Outlined.Folder, size: Dp = 38.dp) {
    val tint = identityColor(color) ?: MaterialTheme.colorScheme.primary
    Box(Modifier.size(size).clip(RoundedCornerShape(size * 0.3f)).background(tint.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) {
        Icon(IDENTITY_ICONS[icon] ?: fallback, null, tint = tint, modifier = Modifier.size(size * 0.52f))
    }
}

/** Choose an icon and a colour; both can be left unset. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun IdentityPicker(icon: String?, color: String?, set: (icon: String?, color: String?) -> Unit) {
    val haptics = rememberHaptics()
    val tint = identityColor(color) ?: MaterialTheme.colorScheme.primary
    Column {
        Eyebrow("Icon")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for (name in (listOfNotNull(icon?.takeIf { it !in PICKER_ICONS }) + PICKER_ICONS)) {
                val on = icon == name
                Box(
                    Modifier.size(42.dp).clip(RoundedCornerShape(12.dp))
                        .background(if (on) tint.copy(alpha = 0.18f) else Color.Transparent)
                        .border(1.dp, if (on) tint else MaterialTheme.colorScheme.outline, RoundedCornerShape(12.dp))
                        .clickable { haptics.tick(); set(if (on) null else name, color) },
                    contentAlignment = Alignment.Center,
                ) { Icon(identityIcon(name), name, tint = if (on) tint else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(22.dp)) }
            }
        }
        Eyebrow("Colour", Modifier.padding(top = 12.dp, bottom = 6.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            for (name in IDENTITY_COLORS) {
                val c = LifeTheme.colors.entity.getValue(name)
                val stored = "var(--entity-$name)"
                val on = color == stored || color == name
                Box(
                    Modifier.size(34.dp).clip(CircleShape).background(c)
                        .border(if (on) 3.dp else 0.dp, MaterialTheme.colorScheme.onSurface, CircleShape)
                        .clickable { haptics.tick(); set(icon, if (on) null else stored) },
                )
            }
        }
    }
}
