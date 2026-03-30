import { useEffect, useState, useRef } from 'react';
import {
  Bluetooth, BluetoothConnected, BluetoothSearching,
  Bell, Volume2, Vibrate, Smartphone,
  Watch, Headphones, MapPin, Cpu,
  Plus, Trash2, Zap, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Wifi,
  ToggleLeft, ToggleRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DeviceStatus = 'connected' | 'disconnected' | 'connecting';

interface PairedDevice {
  id: string;
  name: string;
  type: 'watch' | 'earbuds' | 'tracker' | 'other';
  status: DeviceStatus;
  alertsEnabled: boolean;
  battery?: number;
  lastSeen: string;
  isSimulated: boolean;
}

interface AlertChannel {
  id: 'vibration' | 'notification' | 'sound';
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  supported: boolean;
  needsPermission: boolean;
}

// ─── Device type detection ────────────────────────────────────────────────────

function detectDeviceType(name: string): PairedDevice['type'] {
  const n = name.toLowerCase();
  if (n.includes('watch') || n.includes('band') || n.includes('fit') || n.includes('gear')) return 'watch';
  if (n.includes('airpod') || n.includes('bud') || n.includes('ear') || n.includes('headphone') || n.includes('pod')) return 'earbuds';
  if (n.includes('tile') || n.includes('tag') || n.includes('track')) return 'tracker';
  return 'other';
}

const deviceTypeIcons: Record<PairedDevice['type'], React.ElementType> = {
  watch: Watch,
  earbuds: Headphones,
  tracker: MapPin,
  other: Cpu,
};

const deviceTypeColors: Record<PairedDevice['type'], string> = {
  watch: 'text-blue-500',
  earbuds: 'text-purple-500',
  tracker: 'text-green-500',
  other: 'text-orange-500',
};

const deviceTypeBg: Record<PairedDevice['type'], string> = {
  watch: 'bg-blue-50 dark:bg-blue-900/20',
  earbuds: 'bg-purple-50 dark:bg-purple-900/20',
  tracker: 'bg-green-50 dark:bg-green-900/20',
  other: 'bg-orange-50 dark:bg-orange-900/20',
};

// ─── Alert helpers ────────────────────────────────────────────────────────────

function triggerVibration(): boolean {
  if (!('vibrate' in navigator)) return false;
  navigator.vibrate([200, 100, 200, 100, 400]);
  return true;
}

function triggerSound(): boolean {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    [0, 0.3, 0.6].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.25);
    });
    return true;
  } catch { return false; }
}

async function triggerNotification(): Promise<boolean> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    // @ts-ignore
await reg.showNotification('🚨 PULSE Alert', {
  body: 'Unusual activity detected near your tracked object.',
  icon: '/favicon.ico',
  tag: 'pulse-alert',
  vibrate: [200, 100, 200],
} as NotificationOptions & { vibrate: number[] });
    return true;
  } catch {
    new Notification('🚨 PULSE Alert', { body: 'Unusual activity detected.' });
    return true;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: DeviceStatus }) {
  const map = {
    connected: 'bg-emerald-500 shadow-emerald-400/60',
    disconnected: 'bg-gray-400',
    connecting: 'bg-amber-400 animate-pulse',
  };
  return <span className={`inline-block w-2 h-2 rounded-full shadow ${map[status]}`} />;
}

function DeviceCard({
  device,
  onRemove,
  onToggleAlerts,
  onReconnect,
}: {
  device: PairedDevice;
  onRemove: (id: string) => void;
  onToggleAlerts: (id: string) => void;
  onReconnect: (id: string) => void;
}) {
  const Icon = deviceTypeIcons[device.type];

  return (
    <div className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-4 border transition-all ${
      device.status === 'connected'
        ? 'border-blue-200 dark:border-blue-700 shadow-md shadow-blue-500/10'
        : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${deviceTypeBg[device.type]} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${deviceTypeColors[device.type]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{device.name}</p>
            <StatusDot status={device.status} />
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              device.status === 'connected'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : device.status === 'connecting'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              {device.status === 'connecting' ? 'Connecting…' : device.status === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
            {device.isSimulated && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                App-linked
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 capitalize">{device.type} · Last seen {device.lastSeen}</p>
          {device.battery !== undefined && (
            <div className="flex items-center gap-1 mt-1">
              <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${device.battery > 50 ? 'bg-emerald-500' : device.battery > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${device.battery}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400">{device.battery}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onToggleAlerts(device.id)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${
              device.alertsEnabled
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}
          >
            {device.alertsEnabled
              ? <><ToggleRight className="w-3.5 h-3.5" /> Alerts On</>
              : <><ToggleLeft className="w-3.5 h-3.5" /> Alerts Off</>}
          </button>
          {device.status === 'disconnected' && (
            <button
              onClick={() => onReconnect(device.id)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <BluetoothSearching className="w-3.5 h-3.5" /> Reconnect
            </button>
          )}
        </div>
        <button
          onClick={() => onRemove(device.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const isBTSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

export function BluetoothDevices() {
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [channels, setChannels] = useState<AlertChannel[]>([]);
  const [showChannels, setShowChannels] = useState(false);
  const testTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initChannels();
    return () => { if (testTimer.current) clearTimeout(testTimer.current); };
  }, []);

  const initChannels = async () => {
    const vibSupported = 'vibrate' in navigator;
    const notifSupported = 'Notification' in window;
    const notifGranted = notifSupported && Notification.permission === 'granted';
    const audioSupported = 'AudioContext' in window || 'webkitAudioContext' in window;
    setChannels([
      { id: 'vibration', label: 'Phone Vibration', description: 'Android Chrome only', icon: Vibrate, supported: vibSupported, enabled: vibSupported, needsPermission: false },
      { id: 'notification', label: 'Push Notification', description: 'All browsers', icon: Bell, supported: notifSupported, enabled: notifGranted, needsPermission: notifSupported && !notifGranted },
      { id: 'sound', label: 'Alert Sound', description: 'All browsers', icon: Volume2, supported: audioSupported, enabled: audioSupported, needsPermission: false },
    ]);
  };

  const scanForDevices = async () => {
    setScanError(null);
    setIsScanning(true);
    if (!isBTSupported) {
      setScanError("Your browser doesn't support Web Bluetooth. Use Chrome on Android or desktop. AirPods/Apple Watch: use Quick Add below.");
      setIsScanning(false);
      return;
    }
    try {
      const device = await (navigator as unknown as {
        bluetooth: { requestDevice: (opts: object) => Promise<{ id: string; name?: string; gatt?: unknown }> };
      }).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'heart_rate', 'device_information', 'generic_access'],
      });

      const name = device.name || 'Unknown Device';
      const type = detectDeviceType(name);

      let battery: number | undefined;
      try {
        const btDevice = device as unknown as {
          gatt?: { connect: () => Promise<{ getPrimaryService: (s: string) => Promise<{ getCharacteristic: (c: string) => Promise<{ readValue: () => Promise<DataView> }> }> }> };
        };
        if (btDevice.gatt) {
          const server = await btDevice.gatt.connect();
          const svc = await server.getPrimaryService('battery_service');
          const char = await svc.getCharacteristic('battery_level');
          const val = await char.readValue();
          battery = val.getUint8(0);
        }
      } catch { /* battery optional */ }

      const newDevice: PairedDevice = {
        id: device.id,
        name,
        type,
        status: 'connected',
        alertsEnabled: true,
        battery,
        lastSeen: 'just now',
        isSimulated: false,
      };

      setDevices(prev => prev.find(d => d.id === newDevice.id) ? prev : [...prev, newDevice]);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || '';
      if (!msg.includes('cancelled') && !msg.includes('chosen')) {
        setScanError('Could not connect. Make sure Bluetooth is ON and the device is in pairing mode.');
      }
    } finally {
      setIsScanning(false);
    }
  };

  const addManualDevice = (name: string, type: PairedDevice['type']) => {
    setDevices(prev => [...prev, {
      id: `manual-${Date.now()}`,
      name, type,
      status: 'connected',
      alertsEnabled: true,
      lastSeen: 'just now',
      isSimulated: true,
    }]);
  };

  const removeDevice = (id: string) => setDevices(prev => prev.filter(d => d.id !== id));
  const toggleAlerts = (id: string) => setDevices(prev => prev.map(d => d.id === id ? { ...d, alertsEnabled: !d.alertsEnabled } : d));
  const reconnect = (id: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, status: 'connecting' as DeviceStatus } : d));
    setTimeout(() => setDevices(prev => prev.map(d => d.id === id ? { ...d, status: 'connected' as DeviceStatus, lastSeen: 'just now' } : d)), 2000);
  };

  const toggleChannel = async (id: AlertChannel['id']) => {
    if (id === 'notification') {
      const ch = channels.find(c => c.id === 'notification');
      if (ch?.needsPermission) {
        const result = await Notification.requestPermission();
        setChannels(prev => prev.map(c => c.id === 'notification' ? { ...c, enabled: result === 'granted', needsPermission: result === 'default' } : c));
        return;
      }
    }
    setChannels(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestMsg(null);
    const fired: string[] = [];
    for (const ch of channels) {
      if (!ch.enabled) continue;
      if (ch.id === 'vibration' && triggerVibration()) fired.push('vibration');
      if (ch.id === 'sound' && triggerSound()) fired.push('sound');
      if (ch.id === 'notification' && await triggerNotification()) fired.push('notification');
    }
    setTestMsg(fired.length ? `✓ Fired: ${fired.join(', ')}` : 'No active channels — enable at least one below.');
    setIsTesting(false);
    testTimer.current = setTimeout(() => setTestMsg(null), 4000);
  };

  const connectedCount = devices.filter(d => d.status === 'connected').length;
  const alertReadyCount = devices.filter(d => d.alertsEnabled && d.status === 'connected').length;

  const presets: { name: string; type: PairedDevice['type']; label: string }[] = [
    { name: 'AirPods Pro', type: 'earbuds', label: 'AirPods' },
    { name: 'Apple Watch', type: 'watch', label: 'Apple Watch' },
    { name: 'Galaxy Watch', type: 'watch', label: 'Galaxy Watch' },
    { name: 'Galaxy Buds', type: 'earbuds', label: 'Galaxy Buds' },
    { name: 'Pixel Watch', type: 'watch', label: 'Pixel Watch' },
    { name: 'Tile Tracker', type: 'tracker', label: 'Tile' },
  ];

  return (
    <div className="w-full space-y-5">

      {/* Header + Scan */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Bluetooth Devices</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Pair devices to receive PULSE alerts</p>
        </div>
        <button
          onClick={scanForDevices}
          disabled={isScanning}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl font-medium transition-all shadow-lg shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed self-start sm:self-auto whitespace-nowrap"
        >
          {isScanning
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning…</>
            : <><BluetoothSearching className="w-4 h-4" /> Scan & Pair Device</>}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Paired', value: devices.length, icon: Bluetooth, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Connected', value: connectedCount, icon: BluetoothConnected, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Alert Ready', value: alertReadyCount, icon: Bell, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
          { label: 'Channels On', value: channels.filter(c => c.enabled).length, icon: Wifi, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Scan error */}
      {scanError && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Scan Notice</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{scanError}</p>
          </div>
          <button onClick={() => setScanError(null)} className="text-amber-400 hover:text-amber-600 shrink-0">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Add popular devices */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Quick Add Popular Devices</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          AirPods &amp; Apple Watch can't connect via browser Bluetooth. Add them here to enable phone-based alerts when they're nearby.
        </p>
        <div className="flex flex-wrap gap-2">
          {presets.map(p => {
            const Icon = deviceTypeIcons[p.type];
            const alreadyAdded = devices.some(d => d.name === p.name);
            return (
              <button
                key={p.name}
                onClick={() => !alreadyAdded && addManualDevice(p.name, p.type)}
                disabled={alreadyAdded}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-all ${
                  alreadyAdded
                    ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${alreadyAdded ? 'text-gray-400' : deviceTypeColors[p.type]}`} />
                {alreadyAdded ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Plus className="w-3 h-3" />}
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Device list */}
      {devices.length === 0 ? (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-10 border border-dashed border-gray-300 dark:border-gray-600 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
            <Bluetooth className="w-7 h-7 text-gray-400" />
          </div>
          <p className="font-medium text-gray-600 dark:text-gray-400">No devices paired yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Scan for a BLE device above, or quick-add AirPods / Apple Watch</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {devices.map(device => (
            <DeviceCard
              key={device.id}
              device={device}
              onRemove={removeDevice}
              onToggleAlerts={toggleAlerts}
              onReconnect={reconnect}
            />
          ))}
        </div>
      )}

      {/* Alert Channels collapsible */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => setShowChannels(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Smartphone className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-sm text-gray-900 dark:text-white">Phone Alert Channels</span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              {channels.filter(c => c.enabled).length}/{channels.length} active
            </span>
          </div>
          <span className="text-xs text-gray-400 shrink-0 ml-2">{showChannels ? '▲' : '▼'}</span>
        </button>

        {showChannels && (
          <div className="px-5 pb-5 space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              These alert your phone directly — works for all devices including those that can't be controlled via browser.
            </p>
            {channels.map(ch => {
              const Icon = ch.icon;
              return (
                <div key={ch.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                  ch.enabled ? 'border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700'
                } ${!ch.supported ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${ch.enabled ? 'text-blue-500' : 'text-gray-400'}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{ch.label}</p>
                      <p className="text-[10px] text-gray-400">{ch.description}</p>
                    </div>
                  </div>
                  {!ch.supported ? (
                    <span className="text-[10px] text-red-400 font-medium shrink-0">Not supported</span>
                  ) : ch.needsPermission ? (
                    <button onClick={() => toggleChannel(ch.id)} className="text-[10px] font-semibold px-2.5 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg shrink-0">
                      Grant
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleChannel(ch.id)}
                      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${ch.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ch.enabled ? 'translate-x-5' : ''}`} />
                    </button>
                  )}
                </div>
              );
            })}
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <button
                onClick={handleTest}
                disabled={isTesting || channels.every(c => !c.enabled)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTesting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Testing…</> : <><Zap className="w-3.5 h-3.5 text-yellow-300" /> Test Alerts</>}
              </button>
              {testMsg && (
                <span className={`text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 ${
                  testMsg.startsWith('✓')
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                }`}>
                  {testMsg.startsWith('✓') ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {testMsg}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Supported types */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Supported via Web Bluetooth (Chrome)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { icon: Watch, label: 'Galaxy Watch', sub: 'Wear OS, Fitbit', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { icon: Headphones, label: 'Galaxy Buds', sub: 'Android earbuds', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
            { icon: MapPin, label: 'BLE Trackers', sub: 'Tile, SmartTag', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
            { icon: Cpu, label: 'Any BLE 4.0+', sub: 'Custom devices', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          ].map(({ icon: Icon, label, sub, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
              <Icon className={`w-5 h-5 ${color} mx-auto mb-1`} />
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{label}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{sub}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-3">
          ⚠ AirPods &amp; Apple Watch use iOS-only protocols — browser Bluetooth can't control them. Use Quick Add above to link them for phone-based alerts.
        </p>
      </div>

    </div>
  );
}