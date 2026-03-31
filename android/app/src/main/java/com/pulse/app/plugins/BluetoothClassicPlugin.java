package com.pulse.app.plugins;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "BluetoothClassic")
public class BluetoothClassicPlugin extends Plugin {

    private BluetoothAdapter bluetoothAdapter;
    private BroadcastReceiver discoveryReceiver;
    private BroadcastReceiver stateReceiver;      // ← NEW: listens for connect/disconnect

    @Override
    public void load() {
        BluetoothManager btManager =
            (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        if (btManager != null) {
            bluetoothAdapter = btManager.getAdapter();
        }

        // ── Register connection state receiver on load ─────────────────────
        // Fires "connectionStateChanged" to JS whenever any BT device connects
        // or disconnects — this is how the app knows without polling.
        stateReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (device == null) return;

                boolean connected = false;
                if (BluetoothDevice.ACTION_ACL_CONNECTED.equals(action)) {
                    connected = true;
                } else if (BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(action)) {
                    connected = false;
                } else {
                    // A2DP / HFP profile state change
                    int state = intent.getIntExtra(BluetoothProfile.EXTRA_STATE, -1);
                    connected = (state == BluetoothProfile.STATE_CONNECTED);
                }

                JSObject data = new JSObject();
                data.put("address",   device.getAddress());
                data.put("name",      device.getName() != null ? device.getName() : "Unknown");
                data.put("connected", connected);
                data.put("isPaired",  device.getBondState() == BluetoothDevice.BOND_BONDED);
                notifyListeners("connectionStateChanged", data);
            }
        };

        IntentFilter stateFilter = new IntentFilter();
        stateFilter.addAction(BluetoothDevice.ACTION_ACL_CONNECTED);
        stateFilter.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED);
        stateFilter.addAction("android.bluetooth.a2dp.profile.action.CONNECTION_STATE_CHANGED");
        stateFilter.addAction("android.bluetooth.headset.profile.action.CONNECTION_STATE_CHANGED");
        getContext().registerReceiver(stateReceiver, stateFilter);
    }

    // ─── Helper ────────────────────────────────────────────────────────────

    private JSObject deviceToJS(BluetoothDevice device) {
        JSObject obj = new JSObject();
        obj.put("address",   device.getAddress());
        obj.put("name",      device.getName() != null ? device.getName() : "Unknown Device");
        obj.put("isPaired",  device.getBondState() == BluetoothDevice.BOND_BONDED);
        obj.put("bondState",
            device.getBondState() == BluetoothDevice.BOND_BONDED  ? "bonded"  :
            device.getBondState() == BluetoothDevice.BOND_BONDING ? "bonding" : "none");
        return obj;
    }

    // ─── getConnectedDevices ───────────────────────────────────────────────

    @PluginMethod
    public void getConnectedDevices(PluginCall call) {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.resolve(new JSObject().put("devices", new JSArray()));
            return;
        }
        BluetoothManager btManager =
            (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        JSArray arr = new JSArray();
        if (btManager != null) {
            List<BluetoothDevice> a2dp = btManager.getConnectedDevices(BluetoothProfile.A2DP);
            List<BluetoothDevice> hfp  = btManager.getConnectedDevices(BluetoothProfile.HEADSET);
            for (BluetoothDevice d : a2dp) arr.put(deviceToJS(d));
            for (BluetoothDevice d : hfp) {
                boolean dup = false;
                for (BluetoothDevice a : a2dp) {
                    if (a.getAddress().equals(d.getAddress())) { dup = true; break; }
                }
                if (!dup) arr.put(deviceToJS(d));
            }
        }
        call.resolve(new JSObject().put("devices", arr));
    }

    // ─── getPairedDevices ──────────────────────────────────────────────────

    @PluginMethod
    public void getPairedDevices(PluginCall call) {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.resolve(new JSObject().put("devices", new JSArray()));
            return;
        }
        Set<BluetoothDevice> paired = bluetoothAdapter.getBondedDevices();
        JSArray arr = new JSArray();
        if (paired != null) {
            for (BluetoothDevice d : paired) arr.put(deviceToJS(d));
        }
        call.resolve(new JSObject().put("devices", arr));
    }

    // ─── startDiscovery ────────────────────────────────────────────────────

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth is not enabled");
            return;
        }
        if (bluetoothAdapter.isDiscovering()) bluetoothAdapter.cancelDiscovery();

        discoveryReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                    BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    int rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, Short.MIN_VALUE);
                    if (device != null) {
                        JSObject data = deviceToJS(device);
                        data.put("rssi", rssi);
                        notifyListeners("deviceDiscovered", data);
                    }
                } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                    notifyListeners("discoveryFinished", new JSObject().put("finished", true));
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothDevice.ACTION_FOUND);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        getContext().registerReceiver(discoveryReceiver, filter);

        if (bluetoothAdapter.startDiscovery()) call.resolve();
        else call.reject("Failed to start discovery");
    }

    // ─── stopDiscovery ─────────────────────────────────────────────────────

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        if (bluetoothAdapter != null) bluetoothAdapter.cancelDiscovery();
        if (discoveryReceiver != null) {
            try { getContext().unregisterReceiver(discoveryReceiver); }
            catch (IllegalArgumentException e) { /* already unregistered */ }
            discoveryReceiver = null;
        }
        call.resolve();
    }

    // ─── connectToDevice ───────────────────────────────────────────────────

    @PluginMethod
    public void connectToDevice(PluginCall call) {
        String address = call.getString("address");
        if (address == null || bluetoothAdapter == null) { call.reject("Invalid address"); return; }
        BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
        if (device == null) { call.reject("Device not found"); return; }
        if (device.getBondState() != BluetoothDevice.BOND_BONDED) { call.reject("Not paired"); return; }
        bluetoothAdapter.getProfileProxy(getContext(), new BluetoothProfile.ServiceListener() {
            @Override public void onServiceConnected(int profile, BluetoothProfile proxy) {
                try {
                    Method m = proxy.getClass().getMethod("connect", BluetoothDevice.class);
                    m.invoke(proxy, device);
                    call.resolve();
                } catch (Exception e) { call.reject("Connect failed: " + e.getMessage()); }
                finally { bluetoothAdapter.closeProfileProxy(profile, proxy); }
            }
            @Override public void onServiceDisconnected(int profile) {}
        }, BluetoothProfile.A2DP);
    }

    // ─── disconnectDevice ──────────────────────────────────────────────────

    @PluginMethod
    public void disconnectDevice(PluginCall call) {
        String address = call.getString("address");
        if (address == null || bluetoothAdapter == null) { call.reject("Invalid address"); return; }
        BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
        if (device == null) { call.reject("Device not found"); return; }
        bluetoothAdapter.getProfileProxy(getContext(), new BluetoothProfile.ServiceListener() {
            @Override public void onServiceConnected(int profile, BluetoothProfile proxy) {
                try {
                    Method m = proxy.getClass().getMethod("disconnect", BluetoothDevice.class);
                    m.invoke(proxy, device);
                    call.resolve();
                } catch (Exception e) { call.reject("Disconnect failed: " + e.getMessage()); }
                finally { bluetoothAdapter.closeProfileProxy(profile, proxy); }
            }
            @Override public void onServiceDisconnected(int profile) {}
        }, BluetoothProfile.A2DP);
    }

    // ─── pairDevice ────────────────────────────────────────────────────────

    @PluginMethod
    public void pairDevice(PluginCall call) {
        String address = call.getString("address");
        if (address == null || bluetoothAdapter == null) { call.reject("Invalid address"); return; }
        BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
        if (device == null) { call.reject("Device not found"); return; }
        if (device.getBondState() == BluetoothDevice.BOND_BONDED) { call.resolve(); return; }
        if (device.createBond()) call.resolve();
        else call.reject("Failed to initiate pairing");
    }

    // ─── openBluetoothSettings ─────────────────────────────────────────────

    @PluginMethod
    public void openBluetoothSettings(PluginCall call) {
        Intent intent = new Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    // ─── Cleanup ───────────────────────────────────────────────────────────

    @Override
    protected void handleOnDestroy() {
        if (bluetoothAdapter != null && bluetoothAdapter.isDiscovering())
            bluetoothAdapter.cancelDiscovery();
        if (discoveryReceiver != null) {
            try { getContext().unregisterReceiver(discoveryReceiver); }
            catch (IllegalArgumentException e) { /* ignore */ }
        }
        if (stateReceiver != null) {
            try { getContext().unregisterReceiver(stateReceiver); }
            catch (IllegalArgumentException e) { /* ignore */ }
        }
    }
}