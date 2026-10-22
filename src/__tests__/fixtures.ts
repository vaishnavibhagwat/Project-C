import { buildContext, ENDPOINTS, parseEndpoint, type EndpointDataMap } from '@/data';
import type { EndpointId, GridItemLayout } from '@/types';
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

/** True when any two grid items share a cell. */
export function hasOverlap(layout: readonly GridItemLayout[]): boolean {
  return layout.some((a, i) =>
    layout
      .slice(i + 1)
      .some((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h),
  );
}

/** Shorthand for a grid item. */
export function gridItem(i: string, x: number, y: number, w: number, h: number): GridItemLayout {
  return { i, x, y, w, h };
}
