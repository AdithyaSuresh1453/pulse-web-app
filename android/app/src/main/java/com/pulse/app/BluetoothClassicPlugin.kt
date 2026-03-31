package com.pulse.app

import android.Manifest
import android.bluetooth.*
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import org.json.JSONArray
import org.json.JSONObject

@CapacitorPlugin(
    name = "BluetoothClassic",
    permissions = [
        Permission(strings = [Manifest.permission.BLUETOOTH],            alias = "bluetooth"),
        Permission(strings = [Manifest.permission.BLUETOOTH_ADMIN],      alias = "bluetoothAdmin"),
        Permission(strings = [Manifest.permission.ACCESS_FINE_LOCATION], alias = "location"),
    ]
)
class BluetoothClassicPlugin : Plugin() {

    private val adapter: BluetoothAdapter? by lazy {
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
    }

    private var a2dpProxy: BluetoothA2dp?    = null
    private var hfpProxy: BluetoothHeadset?  = null
    private var discoveryReceiver: BroadcastReceiver? = null
    private var stateReceiver: BroadcastReceiver?     = null

    // ── Load: get A2DP + HFP proxies + listen for state changes ───────────

    override fun load() {
        adapter?.getProfileProxy(context, object : BluetoothProfile.ServiceListener {
            override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
                a2dpProxy = proxy as BluetoothA2dp
                notifyListeners("profileReady", JSObject().put("profile", "a2dp"))
            }
            override fun onServiceDisconnected(profile: Int) { a2dpProxy = null }
        }, BluetoothProfile.A2DP)

        adapter?.getProfileProxy(context, object : BluetoothProfile.ServiceListener {
            override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
                hfpProxy = proxy as BluetoothHeadset
                notifyListeners("profileReady", JSObject().put("profile", "hfp"))
            }
            override fun onServiceDisconnected(profile: Int) { hfpProxy = null }
        }, BluetoothProfile.HEADSET)

        // Live connection state changes
        stateReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                val dev = getDevice(intent) ?: return
                val connected = when (intent.action) {
                    BluetoothDevice.ACTION_ACL_CONNECTED    -> true
                    BluetoothDevice.ACTION_ACL_DISCONNECTED -> false
                    else -> intent.getIntExtra(
                        BluetoothProfile.EXTRA_STATE, -1
                    ) == BluetoothProfile.STATE_CONNECTED
                }
                notifyListeners("connectionStateChanged", JSObject().apply {
                    put("name",      dev.name ?: "Unknown")
                    put("address",   dev.address)
                    put("connected", connected)
                    put("isPaired",  dev.bondState == BluetoothDevice.BOND_BONDED)
                })
            }
        }

        val filter = IntentFilter().apply {
            addAction(BluetoothDevice.ACTION_ACL_CONNECTED)
            addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
            addAction(BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED)
            addAction(BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED)
        }
        context.registerReceiver(stateReceiver, filter)
    }

    // ── Helper ─────────────────────────────────────────────────────────────

    private fun getDevice(intent: Intent): BluetoothDevice? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
        else
            @Suppress("DEPRECATION") intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)

    // ── Paired Devices ─────────────────────────────────────────────────────

    @PluginMethod
    fun getPairedDevices(call: PluginCall) {
        val arr = JSONArray()
        adapter?.bondedDevices?.forEach { dev ->
            arr.put(JSONObject().apply {
                put("name",     dev.name ?: "Unknown")
                put("address",  dev.address)
                put("isPaired", true)
            })
        }
        call.resolve(JSObject().put("devices", arr))
    }

    // ── Connected Devices via A2DP + HFP ───────────────────────────────────

    @PluginMethod
    fun getConnectedDevices(call: PluginCall) {
        val arr  = JSONArray()
        val seen = mutableSetOf<String>()

        fun add(dev: BluetoothDevice) {
            if (seen.add(dev.address)) {
                arr.put(JSONObject().apply {
                    put("name",     dev.name ?: "Unknown")
                    put("address",  dev.address)
                    put("isPaired", true)
                    put("connected", true)
                })
            }
        }

        // A2DP — audio (earbuds, speakers, headphones)
        a2dpProxy?.connectedDevices?.forEach { add(it) }

        // HFP — calls
        hfpProxy?.connectedDevices?.forEach { add(it) }

        // Fallback — reflection
        if (arr.length() == 0) {
            adapter?.bondedDevices?.forEach { dev ->
                try {
                    val ok = dev.javaClass.getMethod("isConnected").invoke(dev) as? Boolean ?: false
                    if (ok) add(dev)
                } catch (_: Exception) {}
            }
        }

        call.resolve(JSObject().put("devices", arr))
    }

    // ── Connect — audio devices managed by OS, open settings ──────────────

    @PluginMethod
    fun connectToDevice(call: PluginCall) {
        openSettings()
        call.resolve()
    }

    @PluginMethod
    fun disconnectDevice(call: PluginCall) {
        openSettings()
        call.resolve()
    }

    @PluginMethod
    fun openBluetoothSettings(call: PluginCall) {
        openSettings()
        call.resolve()
    }

    private fun openSettings() {
        context.startActivity(
            Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
        )
    }

    // ── Pair ───────────────────────────────────────────────────────────────

    @PluginMethod
    fun pairDevice(call: PluginCall) {
        val address = call.getString("address") ?: return call.reject("address required")
        val device  = try { adapter?.getRemoteDevice(address) }
                      catch (e: Exception) { return call.reject("Invalid address: ${e.message}") }
                      ?: return call.reject("BT unavailable")

        if (device.bondState == BluetoothDevice.BOND_BONDED) { call.resolve(); return }
        try { device.createBond(); call.resolve() }
        catch (e: Exception) { call.reject("Pair failed: ${e.message}") }
    }

    // ── Discovery ──────────────────────────────────────────────────────────

    @PluginMethod
    fun startDiscovery(call: PluginCall) {
        adapter?.cancelDiscovery()
        discoveryReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                if (intent.action != BluetoothDevice.ACTION_FOUND) return
                val dev  = getDevice(intent) ?: return
                val rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, Short.MIN_VALUE).toInt()
                notifyListeners("deviceDiscovered", JSObject().apply {
                    put("name",      dev.name ?: "")
                    put("address",   dev.address)
                    put("rssi",      rssi)
                    put("isPaired",  dev.bondState == BluetoothDevice.BOND_BONDED)
                    put("bondState", when (dev.bondState) {
                        BluetoothDevice.BOND_BONDED  -> "bonded"
                        BluetoothDevice.BOND_BONDING -> "bonding"
                        else -> "none"
                    })
                })
            }
        }
        context.registerReceiver(
            discoveryReceiver,
            IntentFilter(BluetoothDevice.ACTION_FOUND)
        )
        adapter?.startDiscovery()
        call.resolve()
    }

    @PluginMethod
    fun stopDiscovery(call: PluginCall) {
        try {
            adapter?.cancelDiscovery()
            discoveryReceiver?.let { context.unregisterReceiver(it) }
            discoveryReceiver = null
        } catch (_: Exception) {}
        call.resolve()
    }

    // ── Cleanup ────────────────────────────────────────────────────────────

    override fun handleOnDestroy() {
        try {
            adapter?.cancelDiscovery()
            discoveryReceiver?.let { context.unregisterReceiver(it) }
            stateReceiver?.let { context.unregisterReceiver(it) }
            a2dpProxy?.let { adapter?.closeProfileProxy(BluetoothProfile.A2DP, it) }
            hfpProxy?.let  { adapter?.closeProfileProxy(BluetoothProfile.HEADSET, it) }
        } catch (_: Exception) {}
    }
}