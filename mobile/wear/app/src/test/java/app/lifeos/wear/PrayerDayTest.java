package app.lifeos.wear;

import static org.junit.Assert.assertEquals;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

import org.junit.Test;

/**
 * The watch must give the same times as the phone app. The expected values
 * come from the phone's adhan.js (4.4.6) for the same places and dates, in UTC.
 */
public class PrayerDayTest {
    private static final String[] CASES = {
        "30.0444,31.2357,Egyptian,shafi,2026,10,21,2026-10-21T02:34,2026-10-21T04:01,2026-10-21T09:41,2026-10-21T12:52,2026-10-21T15:18,2026-10-21T16:36",
        "30.0444,31.2357,Egyptian,hanafi,2026,6,21,2026-06-21T01:08,2026-06-21T02:54,2026-06-21T09:58,2026-06-21T14:50,2026-06-21T16:59,2026-06-21T18:33",
        "31.2001,29.9187,Egyptian,shafi,2026,1,15,2026-01-15T03:27,2026-01-15T04:59,2026-01-15T10:11,2026-01-15T13:01,2026-01-15T15:20,2026-01-15T16:43",
        "21.4225,39.8262,UmmAlQura,shafi,2026,3,1,2026-03-01T02:25,2026-03-01T03:41,2026-03-01T09:33,2026-03-01T12:55,2026-03-01T15:25,2026-03-01T16:55",
        "51.5074,-0.1278,MuslimWorldLeague,shafi,2026,12,1,2026-12-01T05:42,2026-12-01T07:44,2026-12-01T11:51,2026-12-01T13:36,2026-12-01T15:55,2026-12-01T17:50",
    };

    @Test
    public void matchesThePhoneApp() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm", Locale.ROOT);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        for (String line : CASES) {
            String[] f = line.split(",");
            Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
            calendar.clear();
            calendar.set(Integer.parseInt(f[4]), Integer.parseInt(f[5]) - 1, Integer.parseInt(f[6]), 12, 0);
            Date day = calendar.getTime();
            PrayerDay times = PrayerDay.compute(
                Double.parseDouble(f[0]), Double.parseDouble(f[1]), f[2], f[3], day);
            for (int i = 0; i < 6; i++) {
                assertEquals(f[2] + " " + f[3] + " " + f[4] + "-" + f[5] + "-" + f[6] + " " + PrayerDay.KEYS[i],
                    f[7 + i], format.format(times.slots.get(i).at));
            }
        }
    }
}
