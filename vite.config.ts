import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
  // Ensure manifest.json and sw.js are served with correct headers
  server: {
    headers: {
      'Service-Worker-Allowed': '/',
    },
  },
});