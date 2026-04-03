package com.pulse.app;

import static android.content.Context.RECEIVER_NOT_EXPORTED;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.RequiresApi;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.pulse.app.detection.CameraDetectionService;
import com.pulse.app.detection.CameraDetectionService.RegisteredObject;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "CameraDetection")
public class CameraDetectionPlugin extends Plugin {

    private static final String TAG = "CameraDetectionPlugin";

    private CameraDetectionService detectionService;
    private boolean serviceBound = false;

    private BroadcastReceiver detectionReceiver;
    private BroadcastReceiver alertReceiver;

    private List<RegisteredObject> pendingObjects;
    private String pendingRoom;

    // ─────────────────────────────────────────────────────────────
    // SERVICE CONNECTION
    // ─────────────────────────────────────────────────────────────

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            CameraDetectionService.LocalBinder lb =
                    (CameraDetectionService.LocalBinder) binder;

            detectionService = lb.getService();
            serviceBound = true;

            Log.i(TAG, "Service connected");

            // ✅ IMPORTANT FIX
            pushPendingData();

            JSObject status = new JSObject();
            status.put("running", true);
            notifyListeners("serviceStatus", status);
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            serviceBound = false;
            detectionService = null;

            Log.i(TAG, "Service disconnected");

            JSObject status = new JSObject();
            status.put("running", false);
            notifyListeners("serviceStatus", status);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // LIFECYCLE
    // ─────────────────────────────────────────────────────────────

    @Override
    public void load() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerBroadcastReceivers();
        }
    }

    @Override
    protected void handleOnDestroy() {
        unbindAndUnregister();
        super.handleOnDestroy();
    }

    // ─────────────────────────────────────────────────────────────
    // RECEIVERS
    // ─────────────────────────────────────────────────────────────

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    private void registerBroadcastReceivers() {

        detectionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String json = intent.getStringExtra(CameraDetectionService.EXTRA_DETECTIONS);
                if (json == null) return;

                try {
                    JSONArray arr = new JSONArray(json);
                    JSArray jsArr = new JSArray();

                    for (int i = 0; i < arr.length(); i++) {
                        jsArr.put(arr.get(i));
                    }

                    JSObject result = new JSObject();
                    result.put("detections", jsArr);

                    notifyListeners("detectionResult", result);

                } catch (Exception e) {
                    Log.w(TAG, "Detection parse error: " + e.getMessage());
                }
            }
        };

        alertReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String objectName = intent.getStringExtra(CameraDetectionService.EXTRA_ALERT_OBJECT);
                String msg = intent.getStringExtra(CameraDetectionService.EXTRA_ALERT_MSG);

                JSObject alert = new JSObject();
                alert.put("objectName", objectName != null ? objectName : "");
                alert.put("message", msg != null ? msg : "");

                notifyListeners("alert", alert);
            }
        };

        IntentFilter detectionFilter = new IntentFilter(CameraDetectionService.ACTION_DETECTION_RESULT);
        var alertFilter = new IntentFilter(CameraDetectionService.ACTION_ALERT);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                    ContextCompat.registerReceiver(getContext(), detectionReceiver, detectionFilter, ContextCompat.RECEIVER_EXPORTED);
                    ContextCompat.registerReceiver(getContext(), alertReceiver, alertFilter, ContextCompat.RECEIVER_NOT_EXPORTED);
        } else {
    getContext().registerReceiver(detectionReceiver, detectionFilter, Context.RECEIVER_NOT_EXPORTED);

    getContext().registerReceiver(
        alertReceiver,
        alertFilter,
        RECEIVER_NOT_EXPORTED
    );
}
    }

    private void unbindAndUnregister() {
        if (serviceBound) {
            getContext().unbindService(serviceConnection);
            serviceBound = false;
        }

        try { getContext().unregisterReceiver(detectionReceiver); } catch (Exception ignored) {}
        try { getContext().unregisterReceiver(alertReceiver); } catch (Exception ignored) {}
    }

    // ─────────────────────────────────────────────────────────────
    // PLUGIN METHODS
    // ─────────────────────────────────────────────────────────────

    @PluginMethod
    public void startDetection(PluginCall call) {

        JSArray objectsJs = call.getArray("objects");
        String room = call.getString("room", "Unknown Room");

        List<RegisteredObject> objects = parseObjects(objectsJs);

        Intent serviceIntent = new Intent(getContext(), CameraDetectionService.class);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }

        getContext().bindService(serviceIntent, serviceConnection, Context.BIND_AUTO_CREATE);

        pendingObjects = objects;
        pendingRoom = room;

        call.resolve(new JSObject().put("started", true));
    }

    @PluginMethod
    public void stopDetection(PluginCall call) {

        if (serviceBound) {
            getContext().unbindService(serviceConnection);
            serviceBound = false;
        }

        Intent serviceIntent = new Intent(getContext(), CameraDetectionService.class);
        getContext().stopService(serviceIntent);

        call.resolve(new JSObject().put("stopped", true));
    }

    @PluginMethod
    public void setRoom(PluginCall call) {
        String room = call.getString("room", "Unknown Room");

        if (detectionService != null) {
            detectionService.setCurrentRoom(room);
        } else {
            pendingRoom = room;
        }

        call.resolve();
    }

    @PluginMethod
    public void setObjects(PluginCall call) {
        JSArray objectsJs = call.getArray("objects");
        List<RegisteredObject> objects = parseObjects(objectsJs);

        if (detectionService != null) {
            detectionService.setRegisteredObjects(objects);
        } else {
            pendingObjects = objects;
        }

        call.resolve();
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        boolean running = serviceBound &&
                detectionService != null &&
                detectionService.isRunning();

        call.resolve(new JSObject().put("running", running));
    }

    // ─────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────

    private void pushPendingData() {
        if (detectionService == null) return;

        if (pendingObjects != null) {
            detectionService.setRegisteredObjects(pendingObjects);
        }

        if (pendingRoom != null) {
            detectionService.setCurrentRoom(pendingRoom);
        }

        pendingObjects = null;
        pendingRoom = null;
    }

    private List<RegisteredObject> parseObjects(JSArray arr) {

        List<RegisteredObject> list = new ArrayList<>();
        if (arr == null) return list;

        try {
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);

                list.add(new RegisteredObject(
                        o.optString("id"),
                        o.optString("object_name"),
                        o.optString("usual_location")
                ));
            }
        } catch (Exception e) {
            Log.w(TAG, "parseObjects error: " + e.getMessage());
        }

        return list;
    }
}