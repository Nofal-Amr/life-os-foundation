package app.lifeos.wear;

import android.content.Context;

import java.util.Calendar;
import java.util.Date;

/** Names and times as the watch shows them, in the watch's language. */
final class Labels {
    private Labels() {}

    /** A prayer's name; Dhuhr on a Friday is Jumu'ah. */
    static String name(Context context, String key, Date at) {
        switch (key) {
            case "fajr": return context.getString(R.string.fajr);
            case "sunrise": return context.getString(R.string.sunrise);
            case "dhuhr": {
                Calendar calendar = Calendar.getInstance();
                calendar.setTime(at);
                return context.getString(calendar.get(Calendar.DAY_OF_WEEK) == Calendar.FRIDAY
                    ? R.string.jumuah : R.string.dhuhr);
            }
            case "asr": return context.getString(R.string.asr);
            case "maghrib": return context.getString(R.string.maghrib);
            default: return context.getString(R.string.isha);
        }
    }

    /** "5:42 PM" or "17:42", following the watch's own setting. */
    static String time(Context context, Date at) {
        return android.text.format.DateFormat.getTimeFormat(context).format(at);
    }

    /** "1h 20m" / "35 min" until `at`. */
    static String until(Context context, Date at, Date now) {
        long minutes = Math.max(0, (at.getTime() - now.getTime() + 59_999) / 60_000);
        if (minutes >= 60) {
            return context.getString(R.string.hours_minutes, (int) (minutes / 60), (int) (minutes % 60));
        }
        return context.getString(R.string.minutes, (int) minutes);
    }

    static String method(Context context, String method) {
        int id = context.getResources().getIdentifier("m_" + method, "string", context.getPackageName());
        return id == 0 ? method : context.getString(id);
    }
}
