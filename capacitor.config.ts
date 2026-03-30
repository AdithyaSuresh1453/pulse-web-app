import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pulse.app',
  appName: 'Pulse',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Scanning for devices...',
        cancel: 'Cancel',
        availableDevices: 'Available devices',
        noDeviceFound: 'No device found',
      },
    },
  },
};

export default config;