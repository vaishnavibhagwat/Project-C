import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const EnvSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default('Meridian Capital'),
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
