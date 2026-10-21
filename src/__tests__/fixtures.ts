import { buildContext, ENDPOINTS, parseEndpoint, type EndpointDataMap } from '@/data';
import type { EndpointId } from '@/types';
import { istTimeMs } from '@/utils/time';

/** Fixed IST time inside NSE hours: fixtures are identical on every machine and run. */
export const FIXTURE_TIME = istTimeMs('2026-10-20', 11, 42);

/** A validated response for `endpoint`, derived from the shared dataset at FIXTURE_TIME. */
export function fixture<E extends EndpointId>(
  endpoint: E,
  nowMs = FIXTURE_TIME,
): EndpointDataMap[E] {
  const payload = ENDPOINTS[endpoint].derive(buildContext(nowMs));
  return parseEndpoint(endpoint, JSON.parse(JSON.stringify(payload)));
}
