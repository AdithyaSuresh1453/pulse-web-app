package com.pulse.app.plugins;

import android.bluetooth.*;
import android.content.*;
import android.os.Build;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import android.os.Handler;
import android.os.Looper;

@CapacitorPlugin(name = "BluetoothClassic")
public class BluetoothClassicPlugin extends Plugin {

    private BluetoothAdapter bluetoothAdapter;
    private BroadcastReceiver discoveryReceiver;
    private BroadcastReceiver stateReceiver;

    // Debounce map: address → pending disconnect runnable.
    // TWS earbuds fire ACL_DISCONNECTED for one bud then ACL_CONNECTED for the
    // other within ~300ms. Without debounce, the JS sees a disconnect flicker.
    private final Handler debounceHandler = new Handler(Looper.getMainLooper());
    private final Map<String, Runnable> disconnectRunnables = new HashMap<>();
    private static final int DISCONNECT_DEBOUNCE_MS = 1500;

    @Override
    public void load() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        bluetoothAdapter = manager != null ? manager.getAdapter() : null;

        stateReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (device == null) return;
                String address = device.getAddress();
                boolean connected = BluetoothDevice.ACTION_ACL_CONNECTED.equals(intent.getAction());

                if (connected) {
                    // Cancel any pending disconnect for this address (TWS second-bud reconnect)
                    Runnable pending = disconnectRunnables.remove(address);
                    if (pending != null) debounceHandler.removeCallbacks(pending);

                    // Fire connected immediately
                    JSObject obj = new JSObject();
                    obj.put("address", address);
                    obj.put("name", device.getName() != null ? device.getName() : "Unknown");
                    obj.put("connected", true);
                    obj.put("isPaired", device.getBondState() == BluetoothDevice.BOND_BONDED);
                    notifyListeners("connectionStateChanged", obj);
                } else {
                    // Debounce disconnect — TWS earbuds briefly disconnect one bud
                    // before reconnecting. Wait 1500ms before telling JS it disconnected.
                    Runnable pending = disconnectRunnables.remove(address);
                    if (pending != null) debounceHandler.removeCallbacks(pending);

                    Runnable runnable = () -> {
                        disconnectRunnables.remove(address);
                        JSObject obj = new JSObject();
                        obj.put("address", address);
                        obj.put("name", device.getName() != null ? device.getName() : "Unknown");
                        obj.put("connected", false);
                        obj.put("isPaired", device.getBondState() == BluetoothDevice.BOND_BONDED);
                        notifyListeners("connectionStateChanged", obj);
                    };
                    disconnectRunnables.put(address, runnable);
                    debounceHandler.postDelayed(runnable, DISCONNECT_DEBOUNCE_MS);
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothDevice.ACTION_ACL_CONNECTED);
        filter.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED);
        getContext().registerReceiver(stateReceiver, filter);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private JSObject deviceToJS(BluetoothDevice d) {
        JSObject obj = new JSObject();
        obj.put("address", d.getAddress());
        obj.put("name", d.getName() != null ? d.getName() : "Unknown");
        obj.put("isPaired", d.getBondState() == BluetoothDevice.BOND_BONDED);
        return obj;
    }

    // ── getPairedDevices ──────────────────────────────────────────────────────

    @PluginMethod
    public void getPairedDevices(PluginCall call) {
        JSArray arr = new JSArray();
        if (bluetoothAdapter != null) {
            Set<BluetoothDevice> devices = bluetoothAdapter.getBondedDevices();
            if (devices != null) {
                for (BluetoothDevice d : devices) arr.put(deviceToJS(d));
            }
        }
        call.resolve(new JSObject().put("devices", arr));
    }

    // ── getConnectedDevices ───────────────────────────────────────────────────
    // FIX: BluetoothManager.getConnectedDevices() throws IllegalArgumentException
    // on devices that don't support a given profile. We now try each profile
    // individually inside its own try/catch and deduplicate by MAC address.

    @PluginMethod
    public void getConnectedDevices(PluginCall call) {
        JSArray arr = new JSArray();
        BluetoothManager manager = (BluetoothManager) getContext()
                .getSystemService(Context.BLUETOOTH_SERVICE);

        if (manager == null) {
            call.resolve(new JSObject().put("devices", arr));
            return;
        }

        // Profiles to check — each in its own try/catch so one unsupported
        // profile doesn't kill the whole call.
        int[] profilesToCheck = {
            BluetoothProfile.A2DP,       // Audio (earbuds, speakers)
            BluetoothProfile.HEADSET,    // HFP calls
            BluetoothProfile.GATT,       // BLE
            BluetoothProfile.GATT_SERVER // BLE server
        };

        Set<String> seen = new HashSet<>(); // deduplicate by MAC address

        for (int profile : profilesToCheck) {
            try {
                List<BluetoothDevice> devices = manager.getConnectedDevices(profile);
                for (BluetoothDevice d : devices) {
                    if (seen.add(d.getAddress())) { // add() returns false if already present
                        arr.put(deviceToJS(d));
                    }
                }
            } catch (IllegalArgumentException e) {
                // This profile is not supported on this device — skip silently
            } catch (Exception e) {
                // Any other error — log and continue
                android.util.Log.w("BluetoothClassic", "getConnectedDevices profile " + profile + " failed: " + e.getMessage());
            }
        }

        call.resolve(new JSObject().put("devices", arr));
    }

    // ── connectToDevice ───────────────────────────────────────────────────────

    @PluginMethod
    public void connectToDevice(PluginCall call) {
        String address = call.getString("address");
        if (address == null || bluetoothAdapter == null) {
            call.reject("Invalid address");
            return;
        }
        BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
        if (device == null) {
            call.reject("Device not found: " + address);
            return;
        }
        if (device.getBondState() != BluetoothDevice.BOND_BONDED) {
            call.reject("Device not paired. Call pairDevice first.");
            return;
        }
        // IMPORTANT: Do NOT close the proxy in a finally block — closing it
        // immediately after calling connect() tears down the A2DP connection
        // before it finishes establishing (causes "connected for 2 seconds" bug).
        // We resolve immediately after invoking connect(); the ACL broadcast
        // receiver will update the JS UI when the connection actually completes.
        bluetoothAdapter.getProfileProxy(getContext(), new BluetoothProfile.ServiceListener() {
            @Override
            public void onServiceConnected(int profile, BluetoothProfile proxy) {
                try {
                    Method connect = proxy.getClass().getMethod("connect", BluetoothDevice.class);
                    connect.invoke(proxy, device);
                    call.resolve();
                    // Close proxy after a short delay so the connection handshake
                    // has time to complete before we release the proxy reference.
                    debounceHandler.postDelayed(() ->
                        bluetoothAdapter.closeProfileProxy(profile, proxy), 3000);
                } catch (Exception e) {
                    call.reject("Connect failed: " + e.getMessage());
                    bluetoothAdapter.closeProfileProxy(profile, proxy);
                }
            }
            @Override public void onServiceDisconnected(int profile) {}
        }, BluetoothProfile.A2DP);
    }

    // ── disconnectDevice ──────────────────────────────────────────────────────

    @PluginMethod
    public void disconnectDevice(PluginCall call) {
        String address = call.getString("address");
        if (address == null || bluetoothAdapter == null) {
            call.reject("Invalid address");
            return;
        }
        BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
        if (device == null) {
            call.reject("Device not found");
            return;
        }
        bluetoothAdapter.getProfileProxy(getContext(), new BluetoothProfile.ServiceListener() {
            @Override
            public void onServiceConnected(int profile, BluetoothProfile proxy) {
                try {
                    Method disconnect = proxy.getClass().getMethod("disconnect", BluetoothDevice.class);
                    disconnect.invoke(proxy, device);
                    call.resolve();
                    debounceHandler.postDelayed(() ->
                        bluetoothAdapter.closeProfileProxy(profile, proxy), 3000);
                } catch (Exception e) {
                    call.reject("Disconnect failed: " + e.getMessage());
                    bluetoothAdapter.closeProfileProxy(profile, proxy);
                }
            }
            @Override public void onServiceDisconnected(int profile) {}
        }, BluetoothProfile.A2DP);
    }

    // ── pairDevice ────────────────────────────────────────────────────────────

    @PluginMethod
    public void pairDevice(PluginCall call) {
        String address = call.getString("address");
        if (address == null || bluetoothAdapter == null) {
            call.reject("Invalid address");
            return;
        }
        BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
        if (device == null) { call.reject("Device not found"); return; }
        if (device.getBondState() == BluetoothDevice.BOND_BONDED) { call.resolve(); return; }
        boolean ok = device.createBond();
        if (ok) call.resolve(); else call.reject("Failed to initiate pairing");
    }

    // ── startDiscovery ────────────────────────────────────────────────────────

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        if (bluetoothAdapter == null) { call.reject("No adapter"); return; }
        if (bluetoothAdapter.isDiscovering()) bluetoothAdapter.cancelDiscovery();

        discoveryReceiver = new BroadcastReceiver() {
            public void onReceive(Context context, Intent intent) {
                if (!BluetoothDevice.ACTION_FOUND.equals(intent.getAction())) return;
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (device == null) return;
                int rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, (short) -1);
                JSObject obj = deviceToJS(device);
                obj.put("rssi", rssi);
                notifyListeners("deviceDiscovered", obj);
            }
        };
        getContext().registerReceiver(discoveryReceiver, new IntentFilter(BluetoothDevice.ACTION_FOUND));
        boolean started = bluetoothAdapter.startDiscovery();
        if (started) call.resolve(); else call.reject("Discovery failed — check BLUETOOTH_SCAN permission");
    }

    // ── stopDiscovery ─────────────────────────────────────────────────────────

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        if (bluetoothAdapter != null) bluetoothAdapter.cancelDiscovery();
        if (discoveryReceiver != null) {
            try { getContext().unregisterReceiver(discoveryReceiver); } catch (Exception ignored) {}
            discoveryReceiver = null;
        }
        call.resolve();
    }

    // ── openBluetoothSettings ─────────────────────────────────────────────────

    @PluginMethod
    public void openBluetoothSettings(PluginCall call) {
        Intent intent = new Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    @Override
    protected void handleOnDestroy() {
        debounceHandler.removeCallbacksAndMessages(null);
        disconnectRunnables.clear();
        if (bluetoothAdapter != null && bluetoothAdapter.isDiscovering()) {
            bluetoothAdapter.cancelDiscovery();
        }
        if (discoveryReceiver != null) {
            try { getContext().unregisterReceiver(discoveryReceiver); } catch (Exception ignored) {}
        }
        if (stateReceiver != null) {
            try { getContext().unregisterReceiver(stateReceiver); } catch (Exception ignored) {}
        }
    }
}