import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

/** Built-in theme a first-time visitor sees. `light`/`dark` are aliases for the two main themes. */
export const DEFAULT_THEME_VALUES = [
  'light',
  'dark',
  'porcelain',
  'midnight-graphite',
  'high-contrast',
] as const;

const EnvSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default('Meridian Capital'),

  /** Base path the API is addressed under. The mock API runs in the browser and makes no
   * network requests; the base is used for request labels and error messages. */
  VITE_API_BASE_URL: z
    .string()
    .regex(/^(\/|https?:\/\/)/, 'Must start with / or http(s)://')
    .default('/api'),
  /** Live market-data WebSocket. Reserved: the simulated feed runs in the browser, so the app
   * never opens this socket in mock mode. Validated so a real feed can be plugged in later. */
  VITE_WS_URL: z
    .string()
    .regex(/^wss?:\/\//, 'Must start with ws:// or wss://')
    .default('ws://localhost:5173/ws'),
  VITE_DEFAULT_THEME: z.enum(DEFAULT_THEME_VALUES).default('dark'),
  /** Refresh interval (ms) for widgets backed by end-of-day data (NAV, risk, attribution,
   * research). Widgets driven by the intraday tape keep their own faster intervals. */
  VITE_DATA_REFRESH_INTERVAL: z.coerce.number().int().min(1000).max(3_600_000).default(30_000),
  /** Maximum number of widgets on one page. */
  VITE_MAX_WIDGETS: z.coerce.number().int().min(1).max(60).default(20),
  /** Sign in automatically as the demo user (there is no real authentication). */
  VITE_ENABLE_MOCK_AUTH: booleanString.default('true'),

  VITE_DATA_SEED: z.coerce.number().int().nonnegative().default(20240615),
  VITE_API_LATENCY_MS: z.coerce.number().int().min(0).max(10_000).default(180),
  VITE_MOCK_ERROR_RATE: z.coerce.number().min(0).max(1).default(0),
  VITE_USD_INR_RATE: z.coerce.number().positive().finite().default(83.5),
  VITE_TICK_INTERVAL_MS: z.coerce.number().int().min(1000).max(60_000).default(5000),
  VITE_SIMULATE_MARKET_OPEN: booleanString.default('true'),
  VITE_ENABLE_DEVTOOLS: booleanString.default('false'),
});

export type AppEnv = z.infer<typeof EnvSchema>;

/** Parse raw environment values. Exported for tests; the app uses `env`. */
export function parseEnv(raw: Record<string, unknown>): AppEnv {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}

/** Validated runtime configuration. All config comes from .env (VITE_* variables). */
export const env: AppEnv = parseEnv({ ...import.meta.env });
