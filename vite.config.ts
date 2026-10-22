import { defineConfig, loadEnv, type Plugin } from 'vite';
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

const CSP = "script-src 'self'";

/**
 * index.html ships a strict CSP (scripts from this origin only). In the dev server,
 * @vitejs/plugin-react injects an inline React Fast Refresh preamble, which that policy would
 * block, so for `vite serve` only the policy also allows inline scripts. Production builds and
 * `vite preview` keep the strict policy.
 */
function devServerCsp(): Plugin {
  return {
    name: 'meridian:dev-server-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(`content="${CSP}"`, `content="${CSP} 'unsafe-inline'"`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: env.VITE_BASE_PATH ?? '/',
    plugins: [react(), devServerCsp()],
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
