import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    env: {
      VITE_APP_NAME: 'Meridian Capital',
      VITE_DATA_SEED: '20240615',
      VITE_API_LATENCY_MS: '0',
      VITE_MOCK_ERROR_RATE: '0',
      VITE_USD_INR_RATE: '83.5',
      VITE_TICK_INTERVAL_MS: '5000',
      VITE_SIMULATE_MARKET_OPEN: 'true',
      VITE_ENABLE_DEVTOOLS: 'false',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.stories.tsx',
        'src/stories/**',
        'src/**/__tests__/**',
        'src/main.tsx',
        'src/**/index.ts',
        'src/vite-env.d.ts',
      ],
    },
  },
});
