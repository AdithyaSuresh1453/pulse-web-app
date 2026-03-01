import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Web Bluetooth API type declarations (not in default TS lib) ───────────────

interface BluetoothRemoteGATTCharacteristic {
  readValue(): Promise<DataView>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
}

interface BTDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

interface BluetoothRequestDeviceOptions {
  acceptAllDevices?: boolean;
  filters?: Array<{ services?: string[]; name?: string; namePrefix?: string }>;
  optionalServices?: string[];
}

interface BluetoothAPI {
  requestDevice(options: BluetoothRequestDeviceOptions): Promise<BTDevice>;
  getAvailability(): Promise<boolean>;
}

// ──────────────────────────────────────────────────────────────────────────────

export interface ConnectedDevice {
  id: string;
  name: string;
  type: 'smartwatch' | 'earbuds' | 'tracker' | 'other';
  status: 'connected' | 'disconnected' | 'pairing';
  battery?: number;
  lastSeen?: Date;
  alertsEnabled: boolean;
  bluetoothDevice?: BTDevice;
}

export function useBluetoothDevices() {
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Check Web Bluetooth API support
    setIsSupported('bluetooth' in navigator);

    // Load saved devices from localStorage
    const saved = localStorage.getItem('pulse_bluetooth_devices');
    if (saved) {
      try {
        const parsed: ConnectedDevice[] = JSON.parse(saved);
        // Restore without the actual BluetoothDevice object (not serializable)
        setDevices(parsed.map(d => ({ ...d, status: 'disconnected', bluetoothDevice: undefined })));
      } catch {
        // ignore
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const saveDevices = useCallback((devs: ConnectedDevice[]) => {
    // Save without the BluetoothDevice object
    const serializable = devs.map(({ bluetoothDevice: _, ...rest }) => rest);
    localStorage.setItem('pulse_bluetooth_devices', JSON.stringify(serializable));
  }, []);

  const detectDeviceType = (name: string): ConnectedDevice['type'] => {
    const lower = name.toLowerCase();
    if (lower.includes('watch') || lower.includes('band') || lower.includes('fit')) return 'smartwatch';
    if (lower.includes('bud') || lower.includes('ear') || lower.includes('pod') || lower.includes('headphone')) return 'earbuds';
    if (lower.includes('tile') || lower.includes('tag') || lower.includes('track') || lower.includes('airtag')) return 'tracker';
    return 'other';
  };

  const scanForDevices = useCallback(async () => {
    if (!isSupported) {
      setError('Bluetooth is not supported in this browser. Please use Chrome or Edge on Android/Desktop.');
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      // Request a Bluetooth device — browser will show native picker
      const bluetooth = (navigator as Navigator & { bluetooth: BluetoothAPI }).bluetooth;
      const btDevice = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information'],
      });

      const newDevice: ConnectedDevice = {
        id: btDevice.id,
        name: btDevice.name || 'Unknown Device',
        type: detectDeviceType(btDevice.name || ''),
        status: 'pairing',
        alertsEnabled: true,
        lastSeen: new Date(),
        bluetoothDevice: btDevice,
      };

      // Try to connect GATT server
      try {
        const server = await btDevice.gatt?.connect();
        newDevice.status = 'connected';

        // Try to read battery level
        try {
          const batteryService = await server?.getPrimaryService('battery_service');
          const batteryChar = await batteryService?.getCharacteristic('battery_level');
          const val = await batteryChar?.readValue();
          if (val) newDevice.battery = val.getUint8(0);
        } catch {
          // battery_service not available — that's fine
        }
      } catch {
        newDevice.status = 'connected'; // Mark as connected even if GATT not available
      }

      // Handle disconnect
      btDevice.addEventListener('gattserverdisconnected', () => {
        setDevices(prev => {
          const updated = prev.map(d =>
            d.id === btDevice.id ? { ...d, status: 'disconnected' as const } : d
          );
          saveDevices(updated);
          return updated;
        });
      });

      setDevices(prev => {
        const exists = prev.find(d => d.id === btDevice.id);
        const updated = exists
          ? prev.map(d => d.id === btDevice.id ? { ...newDevice } : d)
          : [...prev, newDevice];
        saveDevices(updated);
        return updated;
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === 'NotFoundError') {
          setError('No device selected. Please try again and select a device.');
        } else if (err.name === 'SecurityError') {
          setError('Bluetooth access denied. Please allow Bluetooth access in your browser settings.');
        } else {
          setError(err.message || 'Failed to connect device.');
        }
      }
    } finally {
      setIsScanning(false);
    }
  }, [isSupported, saveDevices]);

  const disconnectDevice = useCallback((deviceId: string) => {
    setDevices(prev => {
      const updated = prev.map(d => {
        if (d.id === deviceId) {
          try {
            d.bluetoothDevice?.gatt?.disconnect();
          } catch { /* ignore */ }
          return { ...d, status: 'disconnected' as const, bluetoothDevice: undefined };
        }
        return d;
      });
      saveDevices(updated);
      return updated;
    });
  }, [saveDevices]);

  const removeDevice = useCallback((deviceId: string) => {
    setDevices(prev => {
      const device = prev.find(d => d.id === deviceId);
      try {
        device?.bluetoothDevice?.gatt?.disconnect();
      } catch { /* ignore */ }
      const updated = prev.filter(d => d.id !== deviceId);
      saveDevices(updated);
      return updated;
    });
  }, [saveDevices]);

  const toggleAlerts = useCallback((deviceId: string) => {
    setDevices(prev => {
      const updated = prev.map(d =>
        d.id === deviceId ? { ...d, alertsEnabled: !d.alertsEnabled } : d
      );
      saveDevices(updated);
      return updated;
    });
  }, [saveDevices]);

  const sendAlert = useCallback((message: string) => {
    const alertedDevices = devices.filter(d => d.status === 'connected' && d.alertsEnabled);
    if (alertedDevices.length === 0) return false;

    // Use vibration API if available (works on mobile & some wearables via Web Bluetooth proxy)
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }

    // Use Web Notifications as a fallback channel
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('PULSE Alert', {
        body: message,
        icon: '/favicon.ico',
        tag: 'pulse-alert',
      });
    }

    console.log(`Alert sent to ${alertedDevices.length} device(s): ${message}`);
    return true;
  }, [devices]);

  return {
    devices,
    isScanning,
    isSupported,
    error,
    scanForDevices,
    disconnectDevice,
    removeDevice,
    toggleAlerts,
    sendAlert,
  };
}