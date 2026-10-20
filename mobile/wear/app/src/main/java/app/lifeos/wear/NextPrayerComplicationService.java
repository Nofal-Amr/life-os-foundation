package app.lifeos.wear;

import android.app.PendingIntent;
import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.wear.watchface.complications.data.ComplicationData;
import androidx.wear.watchface.complications.data.ComplicationType;
import androidx.wear.watchface.complications.data.LongTextComplicationData;
import androidx.wear.watchface.complications.data.PlainComplicationText;
import androidx.wear.watchface.complications.data.ShortTextComplicationData;
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceService;
import androidx.wear.watchface.complications.datasource.ComplicationDataTimeline;
import androidx.wear.watchface.complications.datasource.ComplicationRequest;
import androidx.wear.watchface.complications.datasource.TimeInterval;
import androidx.wear.watchface.complications.datasource.TimelineEntry;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * "Next prayer" for a slot on any watch face: the prayer's name and time. Sent
 * as a timeline through to tomorrow, so it changes at each prayer by itself.
 */
public class NextPrayerComplicationService extends ComplicationDataSourceService {

    @Override
    public void onComplicationRequest(@NonNull ComplicationRequest request, @NonNull ComplicationRequestListener listener) {
        ComplicationType type = request.getComplicationType();
        Date now = new Date();
        List<PrayerDay.Slot> ahead = new ArrayList<>();
        for (int offset = 0; offset <= 1; offset++) {
            PrayerDay day = PrayerDay.on(this, PrayerDay.addDays(now, offset));
            if (day == null) break;
            for (PrayerDay.Slot slot : day.slots) {
                if (slot.isPrayer() && slot.at.after(now)) ahead.add(slot);
            }
        }
        try {
            if (ahead.isEmpty()) {
                listener.onComplicationData(data(type, getString(R.string.complication_label), "—"));
                return;
            }
            ComplicationData first = data(type, Labels.name(this, ahead.get(0).key, ahead.get(0).at),
                Labels.time(this, ahead.get(0).at));
            List<TimelineEntry> entries = new ArrayList<>();
            long start = ahead.get(0).at.getTime();
            for (int i = 1; i < ahead.size(); i++) {
                PrayerDay.Slot slot = ahead.get(i);
                long end = slot.at.getTime();
                entries.add(new TimelineEntry(
                    new TimeInterval(Instant.ofEpochMilli(start), Instant.ofEpochMilli(end)),
                    data(type, Labels.name(this, slot.key, slot.at), Labels.time(this, slot.at))));
                start = end;
            }
            listener.onComplicationDataTimeline(new ComplicationDataTimeline(first, entries));
        } catch (Exception ignored) {
            // The watch face keeps what it had.
        }
    }

    @Nullable
    @Override
    public ComplicationData getPreviewData(@NonNull ComplicationType type) {
        return data(type, getString(R.string.asr), "3:12");
    }

    @Nullable
    private ComplicationData data(ComplicationType type, String name, String time) {
        PendingIntent open = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE);
        PlainComplicationText description = new PlainComplicationText.Builder(name + " " + time).build();
        if (type == ComplicationType.LONG_TEXT) {
            return new LongTextComplicationData.Builder(
                new PlainComplicationText.Builder(name + " · " + time).build(), description)
                .setTapAction(open)
                .build();
        }
        if (type == ComplicationType.SHORT_TEXT) {
            return new ShortTextComplicationData.Builder(new PlainComplicationText.Builder(time).build(), description)
                .setTitle(new PlainComplicationText.Builder(name).build())
                .setTapAction(open)
                .build();
        }
        return null;
    }
}
