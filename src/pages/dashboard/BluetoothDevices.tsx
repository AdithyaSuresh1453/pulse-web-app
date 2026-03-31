import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import BluetoothClassic from '../../plugins/bluetoothClassic';

// BLE optional — won't crash if package missing
let BleClient: any = null;
try { BleClient = require('@capacitor-community/bluetooth-le').BleClient; } catch {}

// ─── Types ───────────────────────────────────────────────────────────────────

type Status   = 'connected' | 'disconnected' | 'connecting' | 'pairing';
type DevType  = 'earbuds' | 'watch' | 'phone' | 'laptop' | 'speaker' | 'other';
type Protocol = 'classic' | 'ble' | 'paired';

interface Device {
  id:        string;
  name:      string;
  type:      DevType;
  status:    Status;
  rssi?:     number;
  lastSeen:  number;
  source:    Protocol;
  isPaired?: boolean;
  address?:  string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const isNative  = Capacitor.isNativePlatform();
const isAndroid = Capacitor.getPlatform() === 'android';
const SCAN_MS   = 12000;
const CACHE_KEY = 'bt_devices_v3';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectType(name: string): DevType {
  const n = name.toLowerCase();
  if (/airpod|bud|earbud|boult|cmf|boat|pod|tws|headphone|headset|earphone|buds|airdopes|rockerz/.test(n)) return 'earbuds';
  if (/watch|band|fit|gear|amazfit|noise|fastrack/.test(n)) return 'watch';
  if (/phone|pixel|samsung|oneplus|redmi|poco|iphone|realme|vivo|oppo/.test(n)) return 'phone';
  if (/laptop|macbook|thinkpad|dell|hp|lenovo|asus/.test(n)) return 'laptop';
  if (/speaker|jbl|bose|sonos|marshall|harman|soundbar|mivi/.test(n)) return 'speaker';
  return 'other';
}

const TYPE_ICON: Record<DevType, string> = {
  earbuds: '🎧', watch: '⌚', phone: '📱',
  laptop: '💻', speaker: '🔊', other: '📡',
};

const STATUS_COLOR: Record<Status, string> = {
  connected: '#00c98d', disconnected: '#ef4444',
  connecting: '#f59e0b', pairing: '#7c6dff',
};

function rssiToBars(rssi?: number) {
  if (!rssi) return 2;
  if (rssi >= -55) return 4;
  if (rssi >= -65) return 3;
  if (rssi >= -75) return 2;
  return 1;
}

function saveCache(devices: Device[]) {
  try {
    const toSave = devices
      .filter(d => d.isPaired || d.source === 'classic' || d.source === 'paired')
      .map(d => ({ ...d, status: 'disconnected' as Status }));
    localStorage.setItem(CACHE_KEY, JSON.stringify(toSave));
  } catch {}
}

function loadCache(): Device[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Device[]) : [];
  } catch { return []; }
}

// ─── Safe plugin wrapper ──────────────────────────────────────────────────────
// Prevents "plugin not ready" crashes when the Capacitor bridge is still
// warming up on navigation (common on Android cold-launch or screen transitions).

async function safeCall<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    console.warn(`[BT] ${label} failed:`, e?.message ?? e);
    return fallback;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BluetoothDevices() {
  const [devices,  setDevices]  = useState<Device[]>(() => loadCache());
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tab,      setTab]      = useState<'all' | 'paired'>('all');
  const [scanMode, setScanMode] = useState<'both' | 'classic' | 'ble'>('both');
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);
  const [permOk,   setPermOk]   = useState<boolean | null>(null);

  const progressRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef      = useRef<Set<string>>(new Set());
  const toastTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false); // guard against double-init on visibilitychange

  // ── Toast ─────────────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Upsert ───────────────────────────────────────────────────────────────

  const upsert = useCallback((incoming: Partial<Device> & Pick<Device, 'id'>) => {
    setDevices(prev => {
      const i = prev.findIndex(d => d.id === incoming.id);
      let next: Device[];
      if (i >= 0) {
        const merged = { ...prev[i], ...incoming, lastSeen: Date.now() };
        if (
          (incoming.name === 'Unknown' || incoming.name === 'Unknown Device') &&
          prev[i].name &&
          prev[i].name !== 'Unknown' &&
          prev[i].name !== 'Unknown Device'
        ) {
          merged.name = prev[i].name;
        }
        next = [...prev];
        next[i] = merged;
      } else {
        next = [{
          name: 'Unknown', type: 'other', status: 'disconnected',
          lastSeen: Date.now(), source: 'ble', ...incoming,
        } as Device, ...prev];
      }
      saveCache(next);
      return next;
    });
  }, []);

  // ── Load paired ───────────────────────────────────────────────────────────

  const loadPaired = useCallback(async () => {
    const result = await safeCall(
      () => BluetoothClassic.getPairedDevices(),
      { devices: [] },
      'getPairedDevices'
    );
    (result.devices || []).forEach((d: any) => upsert({
      id: d.address, address: d.address,
      name: d.name || 'Unknown',
      type: detectType(d.name || ''),
      status: 'disconnected', source: 'paired', isPaired: true,
    }));
  }, [upsert]);

  // ── Load connected ────────────────────────────────────────────────────────

  const loadConnected = useCallback(async () => {
    const result = await safeCall(
      () => BluetoothClassic.getConnectedDevices(),
      { devices: [] },
      'getConnectedDevices'
    );
    const devs = result.devices || [];
    const connectedAddrs = new Set(devs.map((d: any) => d.address as string));

    devs.forEach((d: any) => upsert({
      id: d.address, address: d.address,
      name: d.name || 'Unknown',
      type: detectType(d.name || ''),
      status: 'connected', source: 'classic', isPaired: true,
    }));

    setDevices(prev => {
      const updated = prev.map(d =>
        (d.status === 'connected' || d.status === 'connecting') &&
        d.address && !connectedAddrs.has(d.address)
          ? { ...d, status: 'disconnected' as Status }
          : d
      );
      saveCache(updated);
      return updated;
    });
  }, [upsert]);

  // ── Register listeners ────────────────────────────────────────────────────
  // FIX: removeAllListeners() is wrapped in safeCall — it was throwing on
  // cold navigation before the plugin bridge was ready, crashing the screen.

  const registerListeners = useCallback(() => {
    safeCall(
      () => BluetoothClassic.removeAllListeners(),
      undefined,
      'removeAllListeners'
    ).then(() => {
      try {
        BluetoothClassic.addListener('connectionStateChanged', (dev: any) => {
          console.log('[BT] connectionStateChanged:', dev);
          upsert({
            id: dev.address, address: dev.address,
            name: dev.name || 'Unknown',
            type: detectType(dev.name || ''),
            status: dev.connected ? 'connected' : 'disconnected',
            source: 'classic', isPaired: true,
          });
          busyRef.current.delete(dev.address);
          const label = dev.name && dev.name !== 'Unknown' ? dev.name : null;
          if (label) showToast(`${label} ${dev.connected ? 'connected ✓' : 'disconnected'}`, dev.connected);
        });
      } catch (e) {
        console.warn('[BT] addListener failed:', e);
      }
    });
  }, [upsert, showToast]);

  // ── Request Android permissions safely ───────────────────────────────────
  // requestPermissions() is now typed in BluetoothClassicPlugin — no any cast needed.
  // The native Android side handles BLUETOOTH_CONNECT, BLUETOOTH_SCAN, FINE_LOCATION.

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!isAndroid) return true;
    try {
      const result = await BluetoothClassic.requestPermissions();
      const granted = Object.values(result).every(v => v === 'granted');
      setPermOk(granted);
      return granted;
    } catch {
      // Bridge not ready or method missing — Android prompts on first BT call
      setPermOk(true);
      return true;
    }
  }, []);

  // ── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isNative) return;

    const init = async () => {
      const ok = await requestPermissions();
      if (!ok) return;

      // Small delay to let the Capacitor plugin bridge fully register on Android.
      // Without this, navigating to the screen cold causes "plugin not implemented"
      // errors on BluetoothClassic methods.
      await new Promise(r => setTimeout(r, 150));

      await loadPaired();
      await loadConnected();
      registerListeners();

      initializedRef.current = true;
      // No poll — polling fights ACL broadcast events and causes flicker on TWS earbuds.
      // Connection state is maintained exclusively by the ACL_CONNECTED/DISCONNECTED
      // broadcast receiver in the Java plugin via the connectionStateChanged listener.
    };

    init().catch(e => console.error('[BT] init crash:', e));

    const onVisible = async () => {
      // FIX: Guard prevents double-init if visibilitychange fires before
      // init() completes, which happens on some Android WebView versions.
      if (!initializedRef.current) return;
      if (document.visibilityState !== 'visible') return;
      console.log('[BT] resumed');
      busyRef.current.clear();
      registerListeners();
      await loadPaired();
      // Do NOT call loadConnected() on resume — it causes TWS earbuds to flicker
      // to disconnected during the brief gap between dual ACL links re-establishing.
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      initializedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisible);
      safeCall(
        () => BluetoothClassic.removeAllListeners(),
        undefined,
        'removeAllListeners on unmount'
      );
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── BLE Scan ──────────────────────────────────────────────────────────────

  const startBLE = async () => {
    if (!BleClient) return;
    try {
      await BleClient.initialize({ androidNeverForLocation: true });
      await BleClient.requestLEScan({ allowDuplicates: false }, (r: any) => {
        const name = r.device.name || r.localName || '';
        if (!name) return;
        upsert({
          id: r.device.deviceId, name,
          type: detectType(name),
          rssi: r.rssi ?? undefined,
          source: 'ble', status: 'disconnected',
        });
      });
    } catch (e: any) {
      console.warn('[BT] BLE scan failed:', e?.message);
    }
  };

  const stopBLE = async () => {
    if (!BleClient) return;
    try { await BleClient.stopLEScan(); } catch {}
  };

  // ── Classic Discovery ─────────────────────────────────────────────────────

  const startClassic = async () => {
    try {
      await BluetoothClassic.startDiscovery();
      BluetoothClassic.addListener('deviceDiscovered', (dev: any) => {
        if (!dev.address) return;
        upsert({
          id: dev.address, address: dev.address,
          name: dev.name || 'Classic Device',
          type: detectType(dev.name || ''),
          rssi: dev.rssi ?? undefined,
          source: 'classic', status: 'disconnected',
          isPaired: dev.isPaired || dev.bondState === 'bonded',
        });
      });
    } catch (e) { console.warn('[BT] startDiscovery:', e); }
  };

  const stopClassic = async () => {
    try { await BluetoothClassic.stopDiscovery(); } catch {}
  };

  // ── Scan ──────────────────────────────────────────────────────────────────

  const startScan = async () => {
    if (scanning) return;
    setScanning(true);
    setProgress(0);
    await loadPaired();
    await loadConnected();

    const start = Date.now();
    progressRef.current = setInterval(() => {
      setProgress(Math.min(((Date.now() - start) / SCAN_MS) * 100, 100));
    }, 200);

    if (scanMode !== 'ble')     startClassic();
    if (scanMode !== 'classic') startBLE();

    setTimeout(async () => {
      if (scanMode !== 'ble')     await stopClassic();
      if (scanMode !== 'classic') await stopBLE();
      if (progressRef.current) clearInterval(progressRef.current);
      setProgress(0);
      setScanning(false);
    }, SCAN_MS);
  };

  const stopScan = async () => {
    if (scanMode !== 'ble')     await stopClassic();
    if (scanMode !== 'classic') await stopBLE();
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(0);
    setScanning(false);
  };

  // ── Connect ───────────────────────────────────────────────────────────────

  const connect = async (d: Device) => {
    if (busyRef.current.has(d.id)) return;
    busyRef.current.add(d.id);
    upsert({ id: d.id, status: 'connecting' });
    showToast(`Connecting to ${d.name}…`);
    try {
      await BluetoothClassic.connectToDevice({ address: d.address || d.id });
      upsert({ id: d.id, status: 'connected', isPaired: true });
      showToast(`${d.name} connected ✓`);
      try { if ('vibrate' in navigator) navigator.vibrate([100, 60, 100]); } catch {}
    } catch (e: any) {
      console.error('[BT] connectToDevice:', e);
      upsert({ id: d.id, status: 'disconnected' });
      showToast((e?.message || 'Connection failed').slice(0, 60), false);
    } finally {
      busyRef.current.delete(d.id);
    }
  };

  // ── Disconnect ────────────────────────────────────────────────────────────

  const disconnect = async (d: Device) => {
    if (busyRef.current.has(d.id)) return;
    busyRef.current.add(d.id);
    try {
      await BluetoothClassic.disconnectDevice({ address: d.address || d.id });
      upsert({ id: d.id, status: 'disconnected' });
      showToast(`${d.name} disconnected`);
    } catch (e: any) {
      console.error('[BT] disconnectDevice:', e);
      upsert({ id: d.id, status: 'disconnected' });
    } finally {
      busyRef.current.delete(d.id);
    }
  };

  // ── Pair ──────────────────────────────────────────────────────────────────

  const pair = async (d: Device) => {
    if (busyRef.current.has(d.id)) return;
    busyRef.current.add(d.id);
    upsert({ id: d.id, status: 'pairing' });
    showToast(`Pairing with ${d.name}…`);
    try {
      await BluetoothClassic.pairDevice({ address: d.address || d.id });
      upsert({ id: d.id, status: 'disconnected', isPaired: true });
      showToast(`${d.name} paired! Tap Connect.`);
    } catch (e: any) {
      upsert({ id: d.id, status: 'disconnected' });
      showToast(`Pair failed: ${e?.message || 'rejected'}`, false);
      console.error('[BT] pairDevice:', e);
    } finally {
      busyRef.current.delete(d.id);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const sorted = [...devices].sort((a, b) => {
    const o: Record<Status, number> = { connected: 0, connecting: 1, pairing: 2, disconnected: 3 };
    return o[a.status] - o[b.status];
  });

  const displayed   = tab === 'paired' ? sorted.filter(d => d.isPaired) : sorted;
  const connCount   = devices.filter(d => d.status === 'connected').length;
  const pairedCount = devices.filter(d => d.isPaired).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', paddingBottom: 80 }}>

      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#00c98d' : '#ef4444',
          color: toast.ok ? '#000' : '#fff',
          padding: '10px 20px', borderRadius: 24,
          fontSize: 13, fontWeight: 600, zIndex: 9999,
          whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          fontFamily: "'Outfit', sans-serif",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(128,128,128,0.15)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            Blue<span style={{ color: '#00c98d' }}>tooth</span>
          </div>
          <div style={{
            fontSize: 11, fontFamily: 'monospace', padding: '3px 10px',
            borderRadius: 20, background: 'rgba(128,128,128,0.1)',
            border: '1px solid rgba(128,128,128,0.15)',
          }}>
            <span style={{ color: '#00c98d', fontWeight: 700 }}>{connCount}</span>/{devices.length} connected
          </div>
        </div>

        {/* Scan mode */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['both', 'classic', 'ble'] as const).map(m => (
            <button key={m} onClick={() => setScanMode(m)} style={{
              flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${scanMode === m ? '#00c98d' : 'rgba(128,128,128,0.2)'}`,
              background: scanMode === m ? 'rgba(0,201,141,0.15)' : 'rgba(128,128,128,0.06)',
              color: scanMode === m ? '#00c98d' : 'inherit',
              fontSize: 12, fontWeight: 600, opacity: scanMode === m ? 1 : 0.55,
              fontFamily: "'Outfit', sans-serif",
            }}>
              {m === 'both' ? '⚡ Both' : m === 'classic' ? '🎧 Classic' : '📡 BLE'}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(['all', 'paired'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '9px 0', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${tab === t ? '#00c98d' : 'rgba(128,128,128,0.2)'}`,
              background: tab === t ? '#00c98d' : 'rgba(128,128,128,0.06)',
              color: tab === t ? '#000' : 'inherit',
              fontSize: 13, fontWeight: 600,
              fontFamily: "'Outfit', sans-serif",
            }}>
              {t === 'all' ? `All (${devices.length})` : `Paired (${pairedCount})`}
            </button>
          ))}
        </div>

        {/* Scan button */}
        <button
          onClick={scanning ? stopScan : startScan}
          disabled={!isNative}
          style={{
            width: '100%', padding: 13, borderRadius: 12, border: 'none',
            background: scanning ? '#f59e0b' : '#00c98d',
            color: '#000', fontSize: 14, fontWeight: 700,
            cursor: isNative ? 'pointer' : 'not-allowed',
            fontFamily: "'Outfit', sans-serif",
            opacity: !isNative ? 0.5 : 1,
          }}
        >
          {scanning ? '⏹ Stop Scan' : isNative ? '⚡ Scan for Nearby Devices' : '⚡ Android Only'}
        </button>

        {scanning && (
          <div style={{ height: 3, background: 'rgba(128,128,128,0.15)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: 'linear-gradient(90deg, #7c6dff, #00c98d)',
              width: `${progress}%`, transition: 'width 0.2s linear',
            }} />
          </div>
        )}

        {permOk === false && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
            fontSize: 12, color: '#f59e0b',
          }}>
            ⚠ Bluetooth permissions denied. Go to App Settings → Permissions → Nearby Devices.
          </div>
        )}

        {isNative && pairedCount === 0 && !scanning && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(124,109,255,0.08)', border: '1px solid rgba(124,109,255,0.2)',
            fontSize: 12, color: '#7c6dff', lineHeight: 1.6,
          }}>
            💡 <b>AirPods not showing?</b> Pair them first in{' '}
            <b>Android Settings → Bluetooth</b>, then come back and tap Scan.
          </div>
        )}
      </div>

      {/* Device list */}
      <div style={{ padding: '14px 16px' }}>
        {displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', opacity: 0.4 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎧</div>
            <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.6 }}>
              {scanning
                ? 'Scanning for nearby devices…'
                : tab === 'paired'
                  ? 'No paired devices.\nPair your device in Android Settings first.'
                  : 'Tap Scan to find nearby devices.'}
            </div>
          </div>
        ) : displayed.map(d => {
          const bars   = rssiToBars(d.rssi);
          const isBusy = d.status === 'connecting' || d.status === 'pairing';
          return (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', marginBottom: 8, borderRadius: 14,
              border: `1px solid ${d.status === 'connected' ? 'rgba(0,201,141,0.3)' : 'rgba(128,128,128,0.12)'}`,
              background: d.status === 'connected' ? 'rgba(0,201,141,0.05)' : 'rgba(128,128,128,0.04)',
              opacity: d.status === 'disconnected' ? 0.75 : 1,
              transition: 'all 0.2s',
            }}>

              <div style={{
                width: 46, height: 46, borderRadius: 13, flexShrink: 0,
                background: 'rgba(128,128,128,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, position: 'relative',
              }}>
                {TYPE_ICON[d.type]}
                <div style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 10, height: 10, borderRadius: '50%',
                  background: STATUS_COLOR[d.status],
                  border: '2px solid white', transition: 'background 0.3s',
                }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {d.name}
                </div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2, fontFamily: 'monospace' }}>
                  {d.source} · {d.type} ·{' '}
                  <span style={{ color: STATUS_COLOR[d.status], opacity: 1 }}>
                    {isBusy ? (d.status === 'pairing' ? 'pairing…' : 'connecting…') : d.status}
                  </span>
                  {d.rssi ? ` · ${d.rssi}dBm` : ''}
                  {d.isPaired ? ' · bonded' : ''}
                </div>
              </div>

              {d.rssi && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  {[5, 8, 11, 15].map((h, i) => (
                    <div key={i} style={{
                      width: 3, height: h, borderRadius: 2,
                      background: i < bars ? '#00c98d' : 'rgba(128,128,128,0.2)',
                    }} />
                  ))}
                </div>
              )}

              <div style={{ flexShrink: 0 }}>
                {isBusy && (
                  <button disabled style={{
                    padding: '6px 14px', borderRadius: 8,
                    border: '1px solid rgba(128,128,128,0.2)',
                    background: 'transparent', fontSize: 12, fontWeight: 600,
                    opacity: 0.4, cursor: 'not-allowed', fontFamily: "'Outfit', sans-serif",
                  }}>
                    {d.status === 'pairing' ? 'Pairing…' : 'Connecting…'}
                  </button>
                )}
                {!isBusy && d.status === 'connected' && (
                  <button onClick={() => disconnect(d)} style={{
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                    border: '1px solid #ef4444', background: 'transparent',
                    color: '#ef4444', fontSize: 12, fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif",
                  }}>Disconnect</button>
                )}
                {!isBusy && d.status === 'disconnected' && d.isPaired && (
                  <button onClick={() => connect(d)} style={{
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                    border: '1px solid #00c98d', background: 'transparent',
                    color: '#00c98d', fontSize: 12, fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif",
                  }}>Connect</button>
                )}
                {!isBusy && d.status === 'disconnected' && !d.isPaired && (
                  <button onClick={() => pair(d)} style={{
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                    border: '1px solid #7c6dff', background: 'transparent',
                    color: '#7c6dff', fontSize: 12, fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif",
                  }}>Pair</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}