/// <reference types="vite/client" />

/** Raw VITE_* variables from .env. They are validated and typed at runtime in src/utils/env.ts. */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_DEFAULT_THEME?: string;
  readonly VITE_DATA_REFRESH_INTERVAL?: string;
  readonly VITE_MAX_WIDGETS?: string;
  readonly VITE_ENABLE_MOCK_AUTH?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_DATA_SEED?: string;
  readonly VITE_API_LATENCY_MS?: string;
  readonly VITE_MOCK_ERROR_RATE?: string;
  readonly VITE_USD_INR_RATE?: string;
  readonly VITE_TICK_INTERVAL_MS?: string;
  readonly VITE_SIMULATE_MARKET_OPEN?: string;
  readonly VITE_ENABLE_DEVTOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
