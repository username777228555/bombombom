package ru.stolypin.app.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.ArrayMap;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Map;
import ru.stolypin.app.MainActivity;
import ru.stolypin.app.R;

/**
 * Василий on the home screen. Every style (src/modules/widgets/scenes.ts) is its own widget in the phone's widget list:
 * a nested subclass below, a receiver in AndroidManifest.xml and res/xml/widget_<style>.xml. The picture is
 * res/drawable-nodpi/wg_<scene>_sq|wd.webp, the caption — live text from the plan the app writes (WidgetPlan); the
 * widget changes the caption itself at the planned moments (Tick), so it lives even when the app is closed.
 * 2×2 — the picture and a short line; stretched wide — the line and the details next to Vasily.
 */
public abstract class VasilyWidget extends AppWidgetProvider {

    static final String ACTION_OPEN = "ru.stolypin.app.WIDGET_OPEN";
    static final String EXTRA_ROUTE = "route";
    private static final String ACTION_TICK = "ru.stolypin.app.WIDGET_TICK";
    /** From this width (dp) the widget shows the wide layout. */
    private static final float WIDE_DP = 220f;

    /** The style id, as in scenes.ts. */
    protected abstract String style();

    public static class Live extends VasilyWidget { @Override protected String style() { return "live"; } }
    public static class Floppa extends VasilyWidget { @Override protected String style() { return "floppa"; } }
    public static class Hello extends VasilyWidget { @Override protected String style() { return "hello"; } }
    public static class Yay extends VasilyWidget { @Override protected String style() { return "yay"; } }
    public static class Hmm extends VasilyWidget { @Override protected String style() { return "hmm"; } }
    public static class Grumpy extends VasilyWidget { @Override protected String style() { return "grumpy"; } }
    public static class Reader extends VasilyWidget { @Override protected String style() { return "reader"; } }
    public static class Sleepy extends VasilyWidget { @Override protected String style() { return "sleepy"; } }
    public static class Vzhuh extends VasilyWidget { @Override protected String style() { return "vzhuh"; } }
    public static class Zhdun extends VasilyWidget { @Override protected String style() { return "zhdun"; } }
    public static class Shock extends VasilyWidget { @Override protected String style() { return "shock"; } }
    public static class Knight extends VasilyWidget { @Override protected String style() { return "knight"; } }
    public static class Tsar extends VasilyWidget { @Override protected String style() { return "tsar"; } }

    static final String[] STYLES = { "live", "floppa", "hello", "yay", "hmm", "grumpy", "reader", "sleepy", "vzhuh", "zhdun", "shock", "knight", "tsar" };
    private static final Class<?>[] PROVIDERS = {
        Live.class, Floppa.class, Hello.class, Yay.class, Hmm.class, Grumpy.class, Reader.class,
        Sleepy.class, Vzhuh.class, Zhdun.class, Shock.class, Knight.class, Tsar.class,
    };

    static ComponentName provider(Context ctx, String style) {
        for (int k = 0; k < STYLES.length; k++) if (STYLES[k].equals(style)) return new ComponentName(ctx, PROVIDERS[k]);
        return new ComponentName(ctx, Live.class);
    }

    /** Styles that have at least one widget on the home screen. */
    static java.util.List<String> placed(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        java.util.List<String> out = new java.util.ArrayList<>();
        for (int k = 0; k < STYLES.length; k++) if (mgr.getAppWidgetIds(new ComponentName(ctx, PROVIDERS[k])).length > 0) out.add(STYLES[k]);
        return out;
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        WidgetPlan plan = WidgetPlan.load(ctx);
        for (int id : ids) render(ctx, mgr, id, style(), plan);
        scheduleTick(ctx, plan);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle options) {
        render(ctx, mgr, id, style(), WidgetPlan.load(ctx));
    }

    /** Redraws every widget of every style (a new plan from the app, or the next planned moment). */
    static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        WidgetPlan plan = WidgetPlan.load(ctx);
        boolean any = false;
        for (int k = 0; k < STYLES.length; k++) {
            for (int id : mgr.getAppWidgetIds(new ComponentName(ctx, PROVIDERS[k]))) {
                render(ctx, mgr, id, STYLES[k], plan);
                any = true;
            }
        }
        if (any) scheduleTick(ctx, plan);
    }

    private static void render(Context ctx, AppWidgetManager mgr, int id, String style, WidgetPlan plan) {
        WidgetPlan.Entry e = plan.entry(style, System.currentTimeMillis());
        RemoteViews square = build(ctx, id, e, false);
        RemoteViews wide = build(ctx, id, e, true);
        RemoteViews views;
        if (Build.VERSION.SDK_INT >= 31) {
            // The launcher picks the layout that fits the widget's size itself.
            Map<SizeF, RemoteViews> sizes = new ArrayMap<>();
            sizes.put(new SizeF(100f, 100f), square);
            sizes.put(new SizeF(WIDE_DP, 100f), wide);
            views = new RemoteViews(sizes);
        } else {
            int width = mgr.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
            views = width >= WIDE_DP ? wide : square;
        }
        mgr.updateAppWidget(id, views);
    }

    private static RemoteViews build(Context ctx, int id, WidgetPlan.Entry e, boolean wide) {
        String pkg = ctx.getPackageName();
        RemoteViews v = new RemoteViews(pkg, wide ? R.layout.widget_wide : R.layout.widget_square);
        int picture = ctx.getResources().getIdentifier("wg_" + e.scene + (wide ? "_wd" : "_sq"), "drawable", pkg);
        if (picture != 0) v.setImageViewResource(R.id.scene, picture);
        v.setTextViewText(R.id.say, e.say);
        if (e.streak > 0) {
            v.setTextViewText(R.id.streak, String.valueOf(e.streak));
            v.setViewVisibility(R.id.streak_box, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.streak_box, View.GONE);
        }
        if (wide) {
            v.setTextViewText(R.id.more, e.more);
            v.setViewVisibility(R.id.more, e.more.isEmpty() ? View.GONE : View.VISIBLE);
            // Шлёпа lies on the right of his picture: the text goes on the left.
            boolean left = "floppa".equals(e.scene);
            v.setViewVisibility(R.id.gap_left, left ? View.GONE : View.VISIBLE);
            v.setViewVisibility(R.id.gap_right, left ? View.VISIBLE : View.GONE);
        }
        v.setContentDescription(android.R.id.background, "Василий: " + e.say);
        Intent open = new Intent(ctx, MainActivity.class)
            .setAction(ACTION_OPEN)
            .putExtra(EXTRA_ROUTE, e.route)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(android.R.id.background, PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        return v;
    }

    /** Wakes the widgets at the next planned moment (inexact: a few minutes late is fine, no special permission). */
    private static void scheduleTick(Context ctx, WidgetPlan plan) {
        AlarmManager alarms = ctx.getSystemService(AlarmManager.class);
        if (alarms == null) return;
        Intent tick = new Intent(ctx, Tick.class).setAction(ACTION_TICK);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 0, tick, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        alarms.cancel(pi);
        long next = plan.nextChange(System.currentTimeMillis());
        if (next > 0) alarms.set(AlarmManager.RTC, next + 1000, pi);
    }

    /** The planned moment has come, the clock or the time zone changed, the phone restarted or the app updated. */
    public static class Tick extends BroadcastReceiver {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            updateAll(ctx);
        }
    }
}
