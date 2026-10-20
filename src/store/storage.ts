import { z, type ZodType, type ZodTypeDef } from 'zod';
import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { env } from '@/utils/env';

const EnvelopeSchema = z.object({ state: z.unknown(), version: z.number().int().optional() });

/**
 * localStorage adapter for zustand/persist that validates everything it reads with zod.
 * Corrupt or tampered data is discarded (the store falls back to defaults) instead of crashing.
 */
export function createValidatedStorage<S>(
  schema: ZodType<S, ZodTypeDef, unknown>,
): PersistStorage<S> {
  return {
    getItem: (name): StorageValue<S> | null => {
      try {
        const raw = localStorage.getItem(name);
        if (raw === null) return null;
        const envelope = EnvelopeSchema.safeParse(JSON.parse(raw));
        if (!envelope.success) return null;
        const state = schema.safeParse(envelope.data.state);
        if (!state.success) {
          console.warn(`[persist] Discarding invalid "${name}" state`, state.error.issues[0]);
          return null;
        }
        return { state: state.data, version: envelope.data.version };
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        localStorage.setItem(name, JSON.stringify(value));
      } catch {
        // Quota exceeded or storage disabled: keep working in memory.
      }
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name);
      } catch {
        // ignore
      }
    },
  };
}

export const devtoolsEnabled = import.meta.env.DEV && env.VITE_ENABLE_DEVTOOLS;

/** Short random id for widget instances and saved layouts. */
export function createId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}
