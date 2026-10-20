import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Vendor libraries that are only needed by widgets are split into their own chunks so the
// main bundle stays small and widgets that share a library share one cached download.
const WIDGET_VENDORS: Record<string, string> = {
  recharts: 'vendor-recharts',
  'd3-': 'vendor-d3',
  'react-virtuoso': 'vendor-virtuoso',
  'react-colorful': 'vendor-colorful',
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: env.VITE_BASE_PATH ?? '/',
    plugins: [react()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            for (const [needle, chunk] of Object.entries(WIDGET_VENDORS)) {
              if (id.includes(`node_modules/${needle}`)) return chunk;
            }
            return undefined;
          },
        },
      },
    },
  };
});
