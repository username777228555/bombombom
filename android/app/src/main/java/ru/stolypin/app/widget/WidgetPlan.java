package ru.stolypin.app.widget;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The widgets' script for the coming week, written by the app (src/modules/widgets/plan.ts → WidgetPlugin.update):
 * from t[i] on, a widget of a style shows styles[style].say[i]. The lines are shared between styles where they are the
 * same (streak, details, where a tap leads), «Живой Василий» also has its scene per entry.
 */
final class WidgetPlan {
    static final String PREFS = "vasily_widget";
    static final String KEY = "plan";

    /** What a widget shows now. */
    static final class Entry {
        String say = "Откройте приложение — и я оживу";
        String more = "";
        String route = "/";
        String scene;
        int streak;
    }

    private final JSONObject json;

    private WidgetPlan(JSONObject json) {
        this.json = json;
    }

    static WidgetPlan load(Context ctx) {
        String s = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
        if (s == null) return new WidgetPlan(null);
        try {
            return new WidgetPlan(new JSONObject(s));
        } catch (JSONException e) {
            return new WidgetPlan(null);
        }
    }

    static void save(Context ctx, String plan) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, plan).apply();
    }

    private static String str(JSONArray a, int i, String fallback) {
        if (a == null || i >= a.length() || a.isNull(i)) return fallback;
        return a.optString(i, fallback);
    }

    /** The last entry that has started by `now` (the first one before the plan begins). */
    private int index(long now) {
        JSONArray t = json == null ? null : json.optJSONArray("t");
        if (t == null) return -1;
        int i = 0;
        while (i + 1 < t.length() && t.optLong(i + 1) <= now) i++;
        return t.length() > 0 ? i : -1;
    }

    Entry entry(String style, long now) {
        Entry e = new Entry();
        e.scene = "live".equals(style) ? "hello" : style;
        int i = index(now);
        JSONObject styles = json == null ? null : json.optJSONObject("styles");
        JSONObject s = styles == null ? null : styles.optJSONObject(style);
        if (i < 0 || s == null) return e;
        e.say = str(s.optJSONArray("say"), i, e.say);
        e.more = str(s.optJSONArray("more"), i, str(json.optJSONArray("more"), i, ""));
        e.route = str(s.optJSONArray("route"), i, str(json.optJSONArray("route"), i, "/"));
        e.scene = str(s.optJSONArray("scene"), i, e.scene);
        JSONArray k = json.optJSONArray("streak");
        e.streak = k == null ? 0 : k.optInt(i, 0);
        return e;
    }

    /** When the caption changes next (0 — never: the plan has run out). */
    long nextChange(long now) {
        JSONArray t = json == null ? null : json.optJSONArray("t");
        if (t == null) return 0;
        for (int i = 0; i < t.length(); i++) if (t.optLong(i) > now) return t.optLong(i);
        return 0;
    }
}
