package app.lifeos.wear;

import android.content.Context;

import com.batoulapps.adhan.CalculationMethod;
import com.batoulapps.adhan.CalculationParameters;
import com.batoulapps.adhan.Coordinates;
import com.batoulapps.adhan.Madhab;
import com.batoulapps.adhan.PrayerTimes;
import com.batoulapps.adhan.data.DateComponents;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;

/**
 * One day's prayer times at the saved place, worked out on the watch with the
 * same method the phone app uses (adhan). No network, no account.
 */
final class PrayerDay {
    /** Fajr, sunrise, Dhuhr, Asr, Maghrib, Isha — in that order. */
    static final String[] KEYS = { "fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha" };

    static final class Slot {
        final String key;
        final Date at;

        Slot(String key, Date at) {
            this.key = key;
            this.at = at;
        }

        /** Sunrise is shown, but it isn't a prayer. */
        boolean isPrayer() {
            return !"sunrise".equals(key);
        }
    }

    final List<Slot> slots;

    private PrayerDay(List<Slot> slots) {
        this.slots = slots;
    }

    /** Times for the calendar day containing `day`, or null without a place. */
    static PrayerDay on(Context context, Date day) {
        WearPrefs prefs = WearPrefs.load(context);
        if (!prefs.hasPlace()) return null;
        return compute(prefs.latitude, prefs.longitude, prefs.method, prefs.asrSchool, day);
    }

    /** The day's times for a place, method and Asr school (no Android needed). */
    static PrayerDay compute(double latitude, double longitude, String method, String asrSchool, Date day) {
        CalculationParameters params = method(method).getParameters();
        params.madhab = "hanafi".equals(asrSchool) ? Madhab.HANAFI : Madhab.SHAFI;
        PrayerTimes times = new PrayerTimes(
            new Coordinates(latitude, longitude), DateComponents.from(day), params);
        List<Slot> slots = new ArrayList<>();
        slots.add(new Slot("fajr", times.fajr));
        slots.add(new Slot("sunrise", times.sunrise));
        slots.add(new Slot("dhuhr", times.dhuhr));
        slots.add(new Slot("asr", times.asr));
        slots.add(new Slot("maghrib", times.maghrib));
        slots.add(new Slot("isha", times.isha));
        return new PrayerDay(slots);
    }

    /** The next prayer from `now` (looking into tomorrow after Isha), or null. */
    static Slot next(Context context, Date now) {
        PrayerDay today = on(context, now);
        if (today == null) return null;
        for (Slot slot : today.slots) {
            if (slot.isPrayer() && slot.at.after(now)) return slot;
        }
        PrayerDay tomorrow = on(context, addDays(now, 1));
        return tomorrow == null ? null : tomorrow.slots.get(0);
    }

    static Date addDays(Date date, int days) {
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(date);
        calendar.add(Calendar.DAY_OF_MONTH, days);
        return calendar.getTime();
    }

    /** The phone app's method names (adhan.js) mapped to adhan-java's. */
    static CalculationMethod method(String name) {
        if (name == null) return CalculationMethod.EGYPTIAN;
        switch (name) {
            case "MuslimWorldLeague": return CalculationMethod.MUSLIM_WORLD_LEAGUE;
            case "Karachi": return CalculationMethod.KARACHI;
            case "UmmAlQura": return CalculationMethod.UMM_AL_QURA;
            case "Dubai": return CalculationMethod.DUBAI;
            case "MoonsightingCommittee": return CalculationMethod.MOON_SIGHTING_COMMITTEE;
            case "NorthAmerica": return CalculationMethod.NORTH_AMERICA;
            case "Kuwait": return CalculationMethod.KUWAIT;
            case "Qatar": return CalculationMethod.QATAR;
            case "Singapore": return CalculationMethod.SINGAPORE;
            default: return CalculationMethod.EGYPTIAN;
        }
    }

    /** The methods the watch offers, in the phone app's names. */
    static final String[] METHODS = {
        "Egyptian", "MuslimWorldLeague", "UmmAlQura", "Karachi", "Dubai", "Kuwait", "Qatar",
        "Singapore", "NorthAmerica", "MoonsightingCommittee",
    };
}
