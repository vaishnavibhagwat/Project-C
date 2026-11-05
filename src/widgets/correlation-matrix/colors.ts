import { interpolateGreys, interpolateRdBu } from 'd3-scale-chromatic';

/**
 * Cell colour: d3-scale-chromatic's RdBu, reversed so −1 is blue, 0 white and +1 red. The
 * brief names this palette, so the cells use it in every theme (an exception to theme-token
 * colours; the scale is perceptually balanced and reads for red-green colour blindness).
 * Kept out of model.ts so config.ts does not pull the palette into the main bundle.
 */
export function correlationColor(r: number): string {
  const clamped = Math.max(-1, Math.min(1, r));
  return interpolateRdBu((1 - clamped) / 2);
}

/** Near-black on pale cells, near-white on strong ones (|r| above 0.55), for contrast. */
export function correlationTextColor(r: number): string {
  return Math.abs(r) > 0.55 ? interpolateGreys(0.02) : interpolateGreys(0.92);
}
