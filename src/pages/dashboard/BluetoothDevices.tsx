import { useEffect, useRef, useState, useCallback } from 'react';
import { BleClient, ScanResult } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import BluetoothClassic from '../../plugins/bluetoothClassic';

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

const isNative  = Capacitor.isNativePlatform();
const isAndroid = Capacitor.getPlatform() === 'android';
const SCAN_MS   = 12000;

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
  connected:    '#00c98d',
  disconnected: '#ef4444',
  connecting:   '#f59e0b',
  pairing:      '#7c6dff',
};

function rssiToBars(rssi?: number) {
  if (!rssi) return 2;
  if (rssi >= -55) return 4;
  if (rssi >= -65) return 3;
  if (rssi >= -75) return 2;
  return 1;
}

export default function BluetoothDevices() {
  const [devices,  setDevices]  = useState<Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tab,      setTab]      = useState<'all' | 'paired'>('all');
  const [scanMode, setScanMode] = useState<'both' | 'classic' | 'ble'>('both');
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);
  const [permOk,   setPermOk]   = useState<boolean | null>(null);

  const progressRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef      = useRef<Set<string>>(new Set());

  // ── Toast ───────────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Upsert — never overwrites a real name with 'Unknown' ────────────────

  const upsert = useCallback((incoming: Partial<Device> & Pick<Device, 'id'>) => {
    setDevices(prev => {
      const i = prev.findIndex(d => d.id === incoming.id);
      if (i >= 0) {
        const next = [...prev];
        const merged = { ...next[i], ...incoming, lastSeen: Date.now() };
        if (
          (incoming.name === 'Unknown' || incoming.name === 'Unknown Device') &&
          next[i].name &&
          next[i].name !== 'Unknown' &&
          next[i].name !== 'Unknown Device'
        ) {
          merged.name = next[i].name;
        }
        next[i] = merged;
        return next;
      }
      return [{
        name: 'Unknown', type: 'other', status: 'disconnected',
        lastSeen: Date.now(), source: 'ble', ...incoming,
      } as Device, ...prev];
    });
  }, []);

  // ── Load bonded devices (always available, no proxy needed) ─────────────

  const loadPaired = useCallback(async () => {
    try {
      const { devices: devs } = await BluetoothClassic.getPairedDevices();
      devs.forEach(d => upsert({
        id: d.address, address: d.address,
        name: d.name || 'Unknown',
        type: detectType(d.name || ''),
        status: 'disconnected', source: 'paired', isPaired: true,
      }));
    } catch (e) { console.error('getPaired:', e); }
  }, [upsert]);

  // ── Load currently connected devices via A2DP/HFP ───────────────────────

  const loadConnected = useCallback(async () => {
    try {
      const { devices: devs } = await BluetoothClassic.getConnectedDevices();
      devs.forEach(d => upsert({
        id: d.address, address: d.address,
        name: d.name || 'Unknown',
        type: detectType(d.name || ''),
        status: 'connected', source: 'classic', isPaired: true,
      }));
    } catch (e) { console.error('getConnected:', e); }
  }, [upsert]);

  // ── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isNative) return;

    const init = async () => {
      // 1. Request permissions
      if (isAndroid) {
        try {
          const perm = await (window as any).Permissions?.requestPermissions?.({
            permissions: [
              'android.permission.BLUETOOTH_CONNECT',
              'android.permission.BLUETOOTH_SCAN',
              'android.permission.ACCESS_FINE_LOCATION',
            ],
          });
          const ok = !perm || Object.values(perm).every((v: any) => v === 'granted');
          setPermOk(ok);
          if (!ok) return;
        } catch { setPermOk(true); }
      }

      // 2. Load paired devices immediately — shows your AirPods right away
      await loadPaired();

      // 3. Load currently connected devices
      await loadConnected();

      // 4. Live connect/disconnect events fired by the Java stateReceiver
      //    This fires the instant Android connects or disconnects any device,
      //    even when the user does it from Android Settings.
      BluetoothClassic.addListener('connectionStateChanged', (dev: any) => {
        upsert({
          id: dev.address, address: dev.address,
          name: dev.name || 'Unknown',
          type: detectType(dev.name || ''),
          status: dev.connected ? 'connected' : 'disconnected',
          source: 'classic', isPaired: dev.isPaired ?? true,
        });
        if (!dev.connected && dev.name && dev.name !== 'Unknown') {
          showToast(`${dev.name} disconnected`, false);
        }
        if (dev.connected && dev.name && dev.name !== 'Unknown') {
          showToast(`${dev.name} connected`);
        }
      });

      // 5. Poll every 5s as a safety net
      pollRef.current = setInterval(loadConnected, 5000);
    };

    init();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      BluetoothClassic.removeAllListeners();
    };
  }, []);

  // ── BLE Scan ────────────────────────────────────────────────────────────

  const startBLE = async () => {
    try {
      await BleClient.initialize({ androidNeverForLocation: true });
      await BleClient.requestLEScan({ allowDuplicates: false }, (r: ScanResult) => {
        const name = r.device.name || r.localName || '';
        upsert({
          id: r.device.deviceId,
          name: name || 'BLE Device',
          type: detectType(name),
          rssi: r.rssi ?? undefined,
          source: 'ble', status: 'disconnected',
        });
      });
    } catch (e) {
      showToast('BLE scan failed', false);
      console.error('BLE:', e);
    }
  };

  const stopBLE = async () => {
    try { await BleClient.stopLEScan(); } catch {}
  };

  // ── Classic Discovery ────────────────────────────────────────────────────

  const startClassic = async () => {
    try {
      await BluetoothClassic.startDiscovery();
      BluetoothClassic.addListener('deviceDiscovered', (dev: any) => {
        if (!dev.address) return;
        upsert({
          id: dev.address, address: dev.address,
          name: dev.name || 'Classic Device',
          type: detectType(dev.name || ''),
          rssi: dev.rssi, source: 'classic',
          status: 'disconnected',
          isPaired: dev.bondState === 'bonded',
        });
      });
    } catch (e) { console.error('startDiscovery:', e); }
  };

  const stopClassic = async () => {
    try { await BluetoothClassic.stopDiscovery(); } catch {}
  };

  // ── Scan ────────────────────────────────────────────────────────────────

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

  // ── Connect ─────────────────────────────────────────────────────────────
  // Opens Android BT Settings. connectionStateChanged fires when user connects.
  // We do NOT reset status — the listener handles it.

  const connect = async (d: Device) => {
    if (busyRef.current.has(d.id)) return;
    busyRef.current.add(d.id);
    upsert({ id: d.id, status: 'connecting' });
    showToast(`Opening Bluetooth Settings…`);
    try { await BluetoothClassic.openBluetoothSettings(); } catch {}
    // Free the busy lock after 8s — listener will have updated status by then
    setTimeout(() => {
      busyRef.current.delete(d.id);
      loadConnected(); // refresh in case listener was missed
    }, 8000);
  };

  // ── Disconnect ──────────────────────────────────────────────────────────

  const disconnect = async (d: Device) => {
    if (busyRef.current.has(d.id)) return;
    busyRef.current.add(d.id);
    showToast(`Opening Bluetooth Settings…`);
    try { await BluetoothClassic.openBluetoothSettings(); } catch {}
    setTimeout(() => {
      busyRef.current.delete(d.id);
      loadConnected();
    }, 8000);
  };

  // ── Pair ────────────────────────────────────────────────────────────────

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
    } finally {
      busyRef.current.delete(d.id);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────

  const sorted = [...devices].sort((a, b) => {
    const o: Record<Status, number> = { connected: 0, connecting: 1, pairing: 2, disconnected: 3 };
    return o[a.status] - o[b.status];
  });

  const displayed   = tab === 'paired' ? sorted.filter(d => d.isPaired) : sorted;
  const connCount   = devices.filter(d => d.status === 'connected').length;
  const pairedCount = devices.filter(d => d.isPaired).length;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: '100vh', paddingBottom: 80 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%',
          transform: 'translateX(-50%)',
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

        {/* Title */}
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

        {/* Progress bar */}
        {scanning && (
          <div style={{ height: 3, background: 'rgba(128,128,128,0.15)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: 'linear-gradient(90deg, #7c6dff, #00c98d)',
              width: `${progress}%`, transition: 'width 0.2s linear',
            }} />
          </div>
        )}

        {/* Permission warning */}
        {permOk === false && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.3)',
            fontSize: 12, color: '#f59e0b',
          }}>
            ⚠ Bluetooth permissions denied. Go to App Settings → Permissions → Nearby Devices.
          </div>
        )}

        {/* Hint when no paired devices */}
        {isNative && pairedCount === 0 && !scanning && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(124,109,255,0.08)',
            border: '1px solid rgba(124,109,255,0.2)',
            fontSize: 12, color: '#7c6dff', lineHeight: 1.5,
          }}>
            💡 No paired devices found. First pair your AirPods in <b>Android Settings → Bluetooth</b>, then reopen this screen.
          </div>
        )}
      </div>

      {/* Device List */}
      <div style={{ padding: '14px 16px' }}>
        {displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', opacity: 0.4 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎧</div>
            <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.6 }}>
              {scanning
                ? 'Scanning for devices…'
                : tab === 'paired'
                  ? 'No paired devices.\nBond your AirPods in Android Settings first.'
                  : 'No devices yet. Tap Scan.'}
            </div>
          </div>
        ) : displayed.map(d => {
          const bars   = rssiToBars(d.rssi);
          const isBusy = d.status === 'connecting' || d.status === 'pairing';

          return (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', marginBottom: 8, borderRadius: 14,
              border: `1px solid ${d.status === 'connected'
                ? 'rgba(0,201,141,0.3)'
                : 'rgba(128,128,128,0.12)'}`,
              background: d.status === 'connected'
                ? 'rgba(0,201,141,0.05)'
                : 'rgba(128,128,128,0.04)',
              opacity: d.status === 'disconnected' ? 0.75 : 1,
            }}>

              {/* Icon + pip */}
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
                  border: '2px solid white',
                }} />
              </div>

              {/* Info */}
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
                    {d.status}
                  </span>
                  {d.rssi ? ` · ${d.rssi}dBm` : ''}
                  {d.isPaired ? ' · bonded' : ''}
                </div>
              </div>

              {/* Signal bars */}
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

              {/* Action button */}
              <div style={{ flexShrink: 0 }}>
                {isBusy && (
                  <button disabled style={{
                    padding: '6px 14px', borderRadius: 8,
                    border: '1px solid rgba(128,128,128,0.2)',
                    background: 'transparent', fontSize: 12, fontWeight: 600,
                    opacity: 0.4, cursor: 'not-allowed',
                    fontFamily: "'Outfit', sans-serif",
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
                  }}>
                    Disconnect
                  </button>
                )}

                {!isBusy && d.status === 'disconnected' && d.isPaired && (
                  <button onClick={() => connect(d)} style={{
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                    border: '1px solid #00c98d', background: 'transparent',
                    color: '#00c98d', fontSize: 12, fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif",
                  }}>
                    Connect
                  </button>
                )}

                {!isBusy && d.status === 'disconnected' && !d.isPaired && (
                  <button onClick={() => pair(d)} style={{
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                    border: '1px solid #7c6dff', background: 'transparent',
                    color: '#7c6dff', fontSize: 12, fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif",
                  }}>
                    Pair
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}