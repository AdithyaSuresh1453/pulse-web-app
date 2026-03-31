import { registerPlugin } from '@capacitor/core';

export interface BluetoothDevice {
  name: string;
  address: string;
  rssi?: number;
  isPaired?: boolean;
  bondState?: string;
  connected?: boolean;
}

export interface BluetoothClassicPlugin {
  // ── Permissions ────────────────────────────────────────────────────────────
  // Requests BLUETOOTH_CONNECT, BLUETOOTH_SCAN, ACCESS_FINE_LOCATION at runtime.
  // Returns a map of permission → 'granted' | 'denied' | 'prompt'.
  requestPermissions(): Promise<Record<string, string>>;

  // ── Device queries ─────────────────────────────────────────────────────────
  getPairedDevices(): Promise<{ devices: BluetoothDevice[] }>;
  getConnectedDevices(): Promise<{ devices: BluetoothDevice[] }>;

  // ── Actions ────────────────────────────────────────────────────────────────
  connectToDevice(options: { address: string }): Promise<void>;
  disconnectDevice(options: { address: string }): Promise<void>;
  pairDevice(options: { address: string }): Promise<void>;
  openBluetoothSettings(): Promise<void>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;

  // ── Events ─────────────────────────────────────────────────────────────────
  addListener(
    eventName: 'deviceDiscovered',
    listenerFunc: (device: BluetoothDevice) => void
  ): Promise<{ remove: () => void }>;

  addListener(
    eventName: 'connectionStateChanged',
    listenerFunc: (device: BluetoothDevice & { connected: boolean }) => void
  ): Promise<{ remove: () => void }>;

  addListener(
    eventName: 'profileReady',
    listenerFunc: (data: { profile: string }) => void
  ): Promise<{ remove: () => void }>;

  removeAllListeners(): Promise<void>;
}

const BluetoothClassic = registerPlugin<BluetoothClassicPlugin>('BluetoothClassic');

export default BluetoothClassic;