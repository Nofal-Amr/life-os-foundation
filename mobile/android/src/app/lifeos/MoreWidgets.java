package app.lifeos;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * More home-screen widgets, fed by the same data as the Today widget
 * (setTodayWidget): the one next action, quick adds, and what's left to
 * spend. Each just shows the last figures it was given.
 */
final class MoreWidgets {
    private MoreWidgets() {}

    static void refreshAll(Context context) {
        refresh(context, NextAction.class);
        refresh(context, QuickAdd.class);
        refresh(context, Money.class);
    }

    private static void refresh(Context context, Class<? extends AppWidgetProvider> provider) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
        if (ids.length == 0) return;
        RemoteViews views;
        if (provider == NextAction.class) views = nextAction(context);
        else if (provider == QuickAdd.class) views = quickAdd(context);
        else views = money(context);
        manager.updateAppWidget(ids, views);
    }

    static JSONObject data(Context context) {
        try {
            return new JSONObject(context.getSharedPreferences(PrayerWidget.PREFS, Context.MODE_PRIVATE)
                .getString(TodayWidget.KEY_DATA, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static RemoteViews nextAction(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_next);
        JSONObject data = data(context);
        views.setTextViewText(R.id.next_title, data.optString("next", "Nothing to do right now"));
        views.setTextViewText(R.id.next_detail, data.optString("nextDetail", "Open Life OS to add a task"));
        views.setOnClickPendingIntent(R.id.next_root, open(context, "/dashboard", 7311));
        return views;
    }

    static RemoteViews quickAdd(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick);
        views.setOnClickPendingIntent(R.id.quick_task, open(context, "/dashboard?quick=task", 7321));
        views.setOnClickPendingIntent(R.id.quick_money, open(context, "/dashboard?quick=money", 7322));
        views.setOnClickPendingIntent(R.id.quick_note, open(context, "/dashboard?quick=capture", 7323));
        return views;
    }

    static RemoteViews money(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_money);
        JSONObject data = data(context);
        views.setTextViewText(R.id.money_left, data.optString("left", "—"));
        views.setTextViewText(R.id.money_spent, "Spent today " + data.optString("spent", "—"));
        views.setOnClickPendingIntent(R.id.money_root, open(context, "/finance", 7331));
        return views;
    }

    private static PendingIntent open(Context context, String path, int code) {
        Intent intent = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("lifeos://open" + path))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, code, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** "Next action": the one thing to do now. */
    public static class NextAction extends AppWidgetProvider {
        @Override
        public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
            manager.updateAppWidget(ids, nextAction(context));
        }
    }

    /** "Quick add": task, spending, note. */
    public static class QuickAdd extends AppWidgetProvider {
        @Override
        public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
            manager.updateAppWidget(ids, quickAdd(context));
        }
    }

    /** "Left to spend": money left before payday, and spent today. */
    public static class Money extends AppWidgetProvider {
        @Override
        public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
            manager.updateAppWidget(ids, money(context));
        }
    }
}
