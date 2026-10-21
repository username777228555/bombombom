package ru.stolypin.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import ru.stolypin.app.widget.WidgetPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugin (Василий's home-screen widgets) is registered before the bridge starts.
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
