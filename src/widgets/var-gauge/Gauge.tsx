import { m } from 'framer-motion';
import { memo } from 'react';
import { cssColor } from '@/theme/themes';
import { AMBER_FROM, RED_FROM } from './model';

/** The dial sweeps 180°, from -90° (left, zero) to +90° (right, the scale's maximum). */
const SWEEP = 180;

/** Spring for the needle: settles in about half a second with a small overshoot. */
export const NEEDLE_SPRING = { type: 'spring', stiffness: 110, damping: 13, mass: 0.8 } as const;

/** Degrees from vertical for a value on [0, max] (clamped). */
export function needleAngle(value: number, max: number): number {
  const t = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  return -SWEEP / 2 + t * SWEEP;
}

function point(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [r * Math.sin(rad), -r * Math.cos(rad)];
}

/** SVG path of a ring segment between two angles (degrees from vertical), centred on 0,0. */
export function arcPath(inner: number, outer: number, from: number, to: number): string {
  if (to - from < 0.01) return '';
  const large = to - from > 180 ? 1 : 0;
  const [x0, y0] = point(outer, from);
  const [x1, y1] = point(outer, to);
  const [x2, y2] = point(inner, to);
  const [x3, y3] = point(inner, from);
  const f = (n: number) => n.toFixed(2);
  return [
    `M${f(x0)},${f(y0)}`,
    `A${f(outer)},${f(outer)} 0 ${large} 1 ${f(x1)},${f(y1)}`,
    `L${f(x2)},${f(y2)}`,
    `A${f(inner)},${f(inner)} 0 ${large} 0 ${f(x3)},${f(y3)}`,
    'Z',
  ].join(' ');
}

interface GaugeProps {
  value: number;
  limit: number;
  /** Top of the scale. */
  max: number;
  /** 30-day low and high, drawn as a band inside the zones. */
  range: { min: number; max: number } | null;
  /** Width in px; the dial is half as tall. */
  size: number;
}

/**
 * Custom SVG speedometer: green, amber and red zones (0–70%, 70–90%, 90%+ of the limit), a
 * limit tick, the 30-day VaR range as an inner band, and a needle that springs to the value
 * (Framer Motion; instant when the user prefers reduced motion).
 */
function GaugeImpl({ value, limit, max, range, size }: GaugeProps) {
  const outer = size / 2 - 4;
  const zoneInner = outer * 0.8;
  const bandOuter = zoneInner - 3;
  const bandInner = bandOuter - Math.max(4, outer * 0.1);
  const a = (v: number) => needleAngle(v, max);
  const zones = [
    { key: 'green', from: 0, to: limit * AMBER_FROM, token: 'positive' },
    { key: 'amber', from: limit * AMBER_FROM, to: limit * RED_FROM, token: 'warning' },
    { key: 'red', from: limit * RED_FROM, to: max, token: 'negative' },
  ] as const;
  const [lx0, ly0] = point(bandInner - 2, a(limit));
  const [lx1, ly1] = point(outer + 3, a(limit));
  const needleLength = bandInner - 2;

  return (
    <svg
      width={size}
      height={size / 2 + 8}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size / 2 + 8}`}
      aria-hidden="true"
      data-testid="var-dial"
    >
      {zones.map((z) => (
        <path
          key={z.key}
          data-zone={z.key}
          d={arcPath(zoneInner, outer, a(z.from), a(z.to))}
          fill={cssColor(z.token)}
          fillOpacity={0.75}
        />
      ))}
      <path d={arcPath(bandInner, bandOuter, -90, 90)} fill={cssColor('raised')} />
      {range ? (
        <path
          data-testid="var-range-band"
          d={arcPath(bandInner, bandOuter, a(range.min), Math.max(a(range.max), a(range.min) + 1))}
          fill={cssColor('textMuted')}
          fillOpacity={0.7}
        />
      ) : null}
      <line
        x1={lx0}
        y1={ly0}
        x2={lx1}
        y2={ly1}
        stroke={cssColor('text')}
        strokeWidth={2}
        data-testid="var-limit-tick"
      />
      <m.g
        data-testid="var-needle"
        initial={{ rotate: -SWEEP / 2 }}
        animate={{ rotate: a(value) }}
        transition={NEEDLE_SPRING}
        style={{ originX: 0.5, originY: 0.5 }}
      >
        {/* Invisible circle centred on the hub, so the group rotates about the hub. */}
        <circle r={needleLength} fill="none" stroke="none" />
        <line
          x1={0}
          y1={4}
          x2={0}
          y2={-needleLength}
          stroke={cssColor('text')}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </m.g>
      <circle r={4} fill={cssColor('text')} />
    </svg>
  );
}

export const Gauge = memo(GaugeImpl);
