package com.pulse.app;

import com.getcapacitor.BridgeActivity;
import com.pulse.app.plugins.BluetoothClassicPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(BluetoothClassicPlugin.class);
        super.onCreate(savedInstanceState);
    }
}