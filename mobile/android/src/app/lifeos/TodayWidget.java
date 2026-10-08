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
 * Home-screen "Today" widget: left to spend, spent today, tasks due and the
 * next one, plus + Task / + Spending / Capture that open the app straight
 * into adding. The web app hands over the figures (setTodayWidget) whenever
 * they change; the widget just shows the last ones it was given.
 */
public class TodayWidget extends AppWidgetProvider {
    static final String KEY_DATA = "today";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refresh(context);
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TodayWidget.class));
        if (ids.length == 0) return;
        manager.updateAppWidget(ids, render(context));
    }

    private static RemoteViews render(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);
        views.setOnClickPendingIntent(R.id.today_root, open(context, "/dashboard", 7301));
        views.setOnClickPendingIntent(R.id.today_add_task, open(context, "/dashboard?quick=task", 7302));
        views.setOnClickPendingIntent(R.id.today_add_money, open(context, "/dashboard?quick=money", 7303));
        views.setOnClickPendingIntent(R.id.today_add_capture, open(context, "/dashboard?quick=capture", 7304));
        try {
            JSONObject data = new JSONObject(
                context.getSharedPreferences(PrayerWidget.PREFS, Context.MODE_PRIVATE).getString(KEY_DATA, "{}"));
            if (data.has("left")) views.setTextViewText(R.id.today_left, data.optString("left"));
            if (data.has("spent")) views.setTextViewText(R.id.today_spent, data.optString("spent"));
            if (data.has("tasks")) views.setTextViewText(R.id.today_tasks, data.optString("tasks"));
        } catch (Exception ignored) {
            // Nothing handed over yet.
        }
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
}
