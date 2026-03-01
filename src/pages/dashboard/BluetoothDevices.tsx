import { useState } from 'react';
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Watch,
  Headphones,
  MapPin,
  Cpu,
  Plus,
  Trash2,
  BellOff,
  Bell,
  RefreshCw,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Battery,
  X,
} from 'lucide-react';
import { useBluetoothDevices, ConnectedDevice } from '../../hooks/useBluetoothDevices';

function DeviceIcon({ type, className }: { type: ConnectedDevice['type']; className?: string }) {
  switch (type) {
    case 'smartwatch': return <Watch className={className} />;
    case 'earbuds':    return <Headphones className={className} />;
    case 'tracker':    return <MapPin className={className} />;
    default:           return <Cpu className={className} />;
  }
}

function StatusBadge({ status }: { status: ConnectedDevice['status'] }) {
  if (status === 'connected') {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        Connected
      </span>
    );
  }
  if (status === 'pairing') {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Pairing…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
      Disconnected
    </span>
  );
}

function DeviceCard({
  device,
  onDisconnect,
  onRemove,
  onToggleAlerts,
}: {
  device: ConnectedDevice;
  onDisconnect: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleAlerts: (id: string) => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  const iconColor = device.status === 'connected'
    ? 'text-blue-600 dark:text-blue-400'
    : 'text-gray-400 dark:text-gray-500';

  const bgColor = device.status === 'connected'
    ? 'bg-blue-50 dark:bg-blue-900/20'
    : 'bg-gray-100 dark:bg-gray-700/40';

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-5 border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl ${bgColor} flex items-center justify-center`}>
            <DeviceIcon type={device.type} className={`w-6 h-6 ${iconColor}`} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
              {device.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-0.5">
              {device.type.replace('_', ' ')}
            </p>
          </div>
        </div>
        <StatusBadge status={device.status} />
      </div>

      {/* Battery indicator */}
      {device.battery !== undefined && (
        <div className="flex items-center gap-2 mb-3">
          <Battery className="w-4 h-4 text-gray-400" />
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                device.battery > 50 ? 'bg-green-500' :
                device.battery > 20 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${device.battery}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">{device.battery}%</span>
        </div>
      )}

      {/* Last seen */}
      {device.lastSeen && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          Last seen: {new Date(device.lastSeen).toLocaleTimeString()}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Toggle alerts */}
        <button
          onClick={() => onToggleAlerts(device.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
            device.alertsEnabled
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          title={device.alertsEnabled ? 'Disable alerts for this device' : 'Enable alerts for this device'}
        >
          {device.alertsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          {device.alertsEnabled ? 'Alerts On' : 'Alerts Off'}
        </button>

        {/* Disconnect */}
        {device.status === 'connected' && (
          <button
            onClick={() => onDisconnect(device.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
          >
            <BluetoothOff className="w-3.5 h-3.5" />
            Disconnect
          </button>
        )}

        {/* Remove */}
        {!confirmRemove ? (
          <button
            onClick={() => setConfirmRemove(true)}
            className="ml-auto p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Remove device"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => onRemove(device.id)}
              className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmRemove(false)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function BluetoothDevices() {
  const {
    devices,
    isScanning,
    isSupported,
    error,
    scanForDevices,
    disconnectDevice,
    removeDevice,
    toggleAlerts,
    sendAlert,
  } = useBluetoothDevices();

  const [testResult, setTestResult] = useState<string | null>(null);

  const connectedCount = devices.filter(d => d.status === 'connected').length;
  const alertReadyCount = devices.filter(d => d.status === 'connected' && d.alertsEnabled).length;

  const handleTestAlert = () => {
    const sent = sendAlert('🔔 Test alert from PULSE — your device is working correctly!');
    setTestResult(sent
      ? `Alert sent to ${alertReadyCount} device(s) successfully!`
      : 'No connected devices with alerts enabled.'
    );
    setTimeout(() => setTestResult(null), 4000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Device Connections
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Pair Bluetooth devices to receive instant alerts — smartwatches, earbuds, and trackers
        </p>
      </div>

      {/* Support warning */}
      {!isSupported && (
        <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Web Bluetooth Not Supported
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
              Your browser doesn't support Web Bluetooth. Please use Chrome or Edge on Android or desktop to pair devices. iOS/Safari is not supported by Web Bluetooth.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">{testResult}</p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-4 border border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <BluetoothConnected className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{connectedCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Connected</p>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-4 border border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
            <Bluetooth className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{devices.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Paired Devices</p>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-4 border border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{alertReadyCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Alert Ready</p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={scanForDevices}
          disabled={isScanning || !isSupported}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl font-medium transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isScanning ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Pair New Device
            </>
          )}
        </button>

        {alertReadyCount > 0 && (
          <button
            onClick={handleTestAlert}
            className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 text-gray-700 dark:text-gray-300 rounded-2xl font-medium transition-all"
          >
            <Zap className="w-5 h-5 text-yellow-500" />
            Test Alert
          </button>
        )}
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-3xl p-5 border border-blue-100 dark:border-blue-900/30">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
          <BluetoothConnected className="w-4 h-4" />
          How Device Alerts Work
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-blue-800 dark:text-blue-300">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
            <p>Pair your Bluetooth device using the button above. Your browser will open the device picker.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
            <p>When PULSE detects an unusual activity or forgotten phone, your connected device will vibrate and you'll receive a notification.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
            <p>Toggle alerts on/off per device. You can connect multiple devices like a smartwatch AND earbuds simultaneously.</p>
          </div>
        </div>
      </div>

      {/* Device list */}
      {devices.length === 0 ? (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-12 border border-gray-200 dark:border-gray-700 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
            <Bluetooth className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">No devices paired yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Click "Pair New Device" to connect your smartwatch, earbuds, or any Bluetooth device
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map(device => (
            <DeviceCard
              key={device.id}
              device={device}
              onDisconnect={disconnectDevice}
              onRemove={removeDevice}
              onToggleAlerts={toggleAlerts}
            />
          ))}
        </div>
      )}

      {/* Supported devices info */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Supported Device Types</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Watch, label: 'Smartwatches', desc: 'Wear OS, Samsung, Fitbit', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { icon: Headphones, label: 'Earbuds', desc: 'Any BT headphones', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
            { icon: MapPin, label: 'Trackers', desc: 'Tile, SmartTag', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
            { icon: Cpu, label: 'Other BT', desc: 'Any BT 4.0+ device', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          ].map(({ icon: Icon, label, desc, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl p-3 flex flex-col items-center text-center gap-1`}>
              <Icon className={`w-6 h-6 ${color}`} />
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{label}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}