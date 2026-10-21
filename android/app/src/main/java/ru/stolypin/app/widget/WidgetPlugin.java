package ru.stolypin.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The app's side of the widgets (src/modules/widgets/native.ts): stores the plan of captions, puts a widget on the
 * home screen on request and tells which styles are already there. A tap on a widget opens the app on a screen:
 * the «open» event with its route (kept until the page listens, so a cold start does not lose it).
 */
@CapacitorPlugin(name = "VasilyWidget")
public class WidgetPlugin extends Plugin {

    @Override
    public void load() {
        if (getActivity() != null) opened(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        opened(intent);
    }

    private void opened(Intent intent) {
        if (intent == null || !VasilyWidget.ACTION_OPEN.equals(intent.getAction())) return;
        String route = intent.getStringExtra(VasilyWidget.EXTRA_ROUTE);
        intent.removeExtra(VasilyWidget.EXTRA_ROUTE);
        if (route == null) return;
        JSObject data = new JSObject();
        data.put("route", route);
        notifyListeners("open", data, true);
    }

    @PluginMethod
    public void update(PluginCall call) {
        String plan = call.getString("plan");
        if (plan == null) {
            call.reject("plan is required");
            return;
        }
        Context ctx = getContext();
        WidgetPlan.save(ctx, plan);
        VasilyWidget.updateAll(ctx);
        call.resolve();
    }

    @PluginMethod
    public void pin(PluginCall call) {
        Context ctx = getContext();
        boolean ok = false;
        if (Build.VERSION.SDK_INT >= 26) {
            AppWidgetManager mgr = ctx.getSystemService(AppWidgetManager.class);
            if (mgr != null && mgr.isRequestPinAppWidgetSupported()) {
                ok = mgr.requestPinAppWidget(VasilyWidget.provider(ctx, call.getString("style", "live")), null, null);
            }
        }
        JSObject res = new JSObject();
        res.put("ok", ok);
        call.resolve(res);
    }

    @PluginMethod
    public void placed(PluginCall call) {
        JSArray styles = new JSArray();
        for (String s : VasilyWidget.placed(getContext())) styles.put(s);
        JSObject res = new JSObject();
        res.put("styles", styles);
        call.resolve(res);
    }
}
