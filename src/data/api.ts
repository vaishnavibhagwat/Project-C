import type { EndpointId } from '@/types';
import { env } from '@/utils/env';
import { isConnected } from './connection';
import { getDataset } from './dataset';
import { createTradeSchedule } from './derive/trades';
import { ENDPOINTS, type EndpointDataMap } from './endpoints';
import { getMarketSnapshot, primeMarket } from './market';
import type { DeriveContext } from './derive/context';

/** Thrown when the (simulated) data feed is unreachable. Shown as the disconnected state. */
export class ConnectionError extends Error {
  override readonly name = 'ConnectionError';
}

/** Thrown when a response fails schema validation. Never shown as data. */
export class ValidationError extends Error {
  override readonly name = 'ValidationError';
}

/** Thrown for injected server failures (VITE_MOCK_ERROR_RATE). */
export class ApiError extends Error {
  override readonly name = 'ApiError';
}

export interface FetchOptions {
  signal?: AbortSignal;
  latencyMs?: number;
  errorRate?: number;
  now?: () => number;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ms <= 0) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Request aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Request path for an endpoint under VITE_API_BASE_URL, e.g. /api/risk/var. Used for labels and
 * error messages: the mock API answers in the browser and makes no network request. */
export function endpointUrl(endpoint: EndpointId, base: string = env.VITE_API_BASE_URL): string {
  return `${base.replace(/\/+$/, '')}/${endpoint}`;
}

export function buildContext(nowMs: number): DeriveContext {
  const dataset = getDataset(nowMs);
  const market = getMarketSnapshot(dataset, nowMs, createTradeSchedule(dataset));
  return { dataset, market, nowMs };
}

/** Objects that passed schema validation, tagged with the endpoint that validated them. */
const validated = new WeakMap<object, EndpointId>();

/** Type guard: true only for objects returned by fetchEndpoint for this endpoint. */
export function isEndpointData<E extends EndpointId>(endpoint: E) {
  return (value: unknown): value is EndpointDataMap[E] =>
    typeof value === 'object' && value !== null && validated.get(value) === endpoint;
}

/** Validate untrusted JSON for an endpoint. Throws ValidationError with the zod issues. */
export function parseEndpoint<E extends EndpointId>(
  endpoint: E,
  json: unknown,
): EndpointDataMap[E] {
  const spec = ENDPOINTS[endpoint];
  const result = spec.schema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ValidationError(
      `Invalid ${endpoint} response${issue ? ` at ${issue.path.join('.') || 'root'}: ${issue.message}` : ''}`,
    );
  }
  validated.set(result.data, endpoint);
  return result.data;
}

/**
 * Mock API. Derives the response from the shared dataset, serialises it (as a real network
 * response would be) and validates it with zod before anything renders it.
 */
export async function fetchEndpoint<E extends EndpointId>(
  endpoint: E,
  options: FetchOptions = {},
): Promise<EndpointDataMap[E]> {
  const latency = options.latencyMs ?? env.VITE_API_LATENCY_MS;
  const errorRate = options.errorRate ?? env.VITE_MOCK_ERROR_RATE;
  const jitter = latency > 0 ? Math.round(latency * 0.5 * Math.random()) : 0;
  await wait(latency + jitter, options.signal);

  if (!isConnected()) {
    throw new ConnectionError(`GET ${endpointUrl(endpoint)} failed: data feed disconnected`);
  }
  if (errorRate > 0 && Math.random() < errorRate) {
    throw new ApiError(`GET ${endpointUrl(endpoint)} returned 503 (simulated upstream failure)`);
  }

  const nowMs = (options.now ?? Date.now)();
  const dataset = getDataset(nowMs);
  await primeMarket(dataset, nowMs, createTradeSchedule(dataset));
  const payload = ENDPOINTS[endpoint].derive(buildContext(nowMs));
  const wire: unknown = JSON.parse(JSON.stringify(payload));
  return parseEndpoint(endpoint, wire);
}
