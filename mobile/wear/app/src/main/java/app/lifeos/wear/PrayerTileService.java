package app.lifeos.wear;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.concurrent.futures.CallbackToFutureAdapter;
import androidx.wear.protolayout.ActionBuilders;
import androidx.wear.protolayout.ColorBuilders;
import androidx.wear.protolayout.DeviceParametersBuilders;
import androidx.wear.protolayout.LayoutElementBuilders;
import androidx.wear.protolayout.ModifiersBuilders;
import androidx.wear.protolayout.ResourceBuilders;
import androidx.wear.protolayout.TimelineBuilders;
import androidx.wear.protolayout.material.Text;
import androidx.wear.protolayout.material.Typography;
import androidx.wear.protolayout.material.layouts.PrimaryLayout;
import androidx.wear.tiles.RequestBuilders;
import androidx.wear.tiles.TileBuilders;
import androidx.wear.tiles.TileService;

import com.google.common.util.concurrent.ListenableFuture;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * The "Prayer times" tile: the next prayer and its time, and the one after.
 * It carries a timeline through to tomorrow's Fajr, so it moves on to the next
 * prayer by itself without waking the app.
 */
public class PrayerTileService extends TileService {
    private static final String RESOURCES = "1";
    private static final int WHITE = 0xFFFFFFFF;
    private static final int DIM = 0xA0FFFFFF;

    @NonNull
    @Override
    protected ListenableFuture<TileBuilders.Tile> onTileRequest(@NonNull RequestBuilders.TileRequest request) {
        TileBuilders.Tile tile = build(this, request.getDeviceConfiguration(), new Date());
        return CallbackToFutureAdapter.getFuture(completer -> completer.set(tile));
    }

    @NonNull
    @Override
    protected ListenableFuture<ResourceBuilders.Resources> onTileResourcesRequest(
        @NonNull RequestBuilders.ResourcesRequest request) {
        ResourceBuilders.Resources resources = new ResourceBuilders.Resources.Builder().setVersion(RESOURCES).build();
        return CallbackToFutureAdapter.getFuture(completer -> completer.set(resources));
    }

    static TileBuilders.Tile build(Context context, DeviceParametersBuilders.DeviceParameters device, Date now) {
        TimelineBuilders.Timeline.Builder timeline = new TimelineBuilders.Timeline.Builder();
        List<PrayerDay.Slot> ahead = upcoming(context, now);
        long freshUntil;
        if (ahead.size() < 2) {
            timeline.addTimelineEntry(new TimelineBuilders.TimelineEntry.Builder()
                .setLayout(layout(context, device, null, null))
                .build());
            freshUntil = 60 * 60_000L;
        } else {
            // One entry per stretch: from now (then from each prayer) until the next one.
            long start = now.getTime();
            for (int i = 0; i + 1 < ahead.size(); i++) {
                PrayerDay.Slot next = ahead.get(i);
                long end = next.at.getTime();
                timeline.addTimelineEntry(new TimelineBuilders.TimelineEntry.Builder()
                    .setValidity(new TimelineBuilders.TimeInterval.Builder()
                        .setStartMillis(start).setEndMillis(end).build())
                    .setLayout(layout(context, device, next, ahead.get(i + 1)))
                    .build());
                start = end;
            }
            freshUntil = Math.max(60_000L, start - now.getTime());
        }
        return new TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES)
            .setTileTimeline(timeline.build())
            .setFreshnessIntervalMillis(freshUntil)
            .build();
    }

    /** Prayers (not sunrise) from now through tomorrow's Fajr and Dhuhr. */
    private static List<PrayerDay.Slot> upcoming(Context context, Date now) {
        List<PrayerDay.Slot> ahead = new ArrayList<>();
        for (int offset = 0; offset <= 1; offset++) {
            PrayerDay day = PrayerDay.on(context, PrayerDay.addDays(now, offset));
            if (day == null) return ahead;
            for (PrayerDay.Slot slot : day.slots) {
                if (slot.isPrayer() && slot.at.after(now)) ahead.add(slot);
            }
        }
        return ahead;
    }

    private static LayoutElementBuilders.Layout layout(Context context,
        DeviceParametersBuilders.DeviceParameters device, PrayerDay.Slot next, PrayerDay.Slot after) {
        PrimaryLayout.Builder layout = new PrimaryLayout.Builder(device);
        if (next == null) {
            layout.setContent(text(context, context.getString(R.string.no_place), Typography.TYPOGRAPHY_BODY2, WHITE));
        } else {
            layout.setPrimaryLabelTextContent(
                text(context, context.getString(R.string.next), Typography.TYPOGRAPHY_CAPTION1, DIM));
            layout.setContent(new LayoutElementBuilders.Column.Builder()
                .addContent(text(context, Labels.name(context, next.key, next.at), Typography.TYPOGRAPHY_TITLE1, WHITE))
                .addContent(text(context, Labels.time(context, next.at), Typography.TYPOGRAPHY_DISPLAY3,
                    MainActivity.ACCENT))
                .build());
            if (after != null) {
                layout.setSecondaryLabelTextContent(text(context,
                    Labels.name(context, after.key, after.at) + " " + Labels.time(context, after.at),
                    Typography.TYPOGRAPHY_CAPTION1, DIM));
            }
        }
        // Tapping the tile opens the app.
        LayoutElementBuilders.Box root = new LayoutElementBuilders.Box.Builder()
            .addContent(layout.build())
            .setModifiers(new ModifiersBuilders.Modifiers.Builder()
                .setClickable(new ModifiersBuilders.Clickable.Builder()
                    .setId("open")
                    .setOnClick(new ActionBuilders.LaunchAction.Builder()
                        .setAndroidActivity(new ActionBuilders.AndroidActivity.Builder()
                            .setPackageName(context.getPackageName())
                            .setClassName(MainActivity.class.getName())
                            .build())
                        .build())
                    .build())
                .build())
            .build();
        return new LayoutElementBuilders.Layout.Builder().setRoot(root).build();
    }

    private static Text text(Context context, String value, int typography, int color) {
        return new Text.Builder(context, value)
            .setTypography(typography)
            .setColor(ColorBuilders.argb(color))
            .setMaxLines(2)
            .build();
    }
}
