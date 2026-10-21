import { arc } from 'd3';
import { memo, useMemo } from 'react';
import { cssColor } from '@/theme/themes';
import type { LimitStatus } from './model';

const START = -Math.PI / 2;
const END = Math.PI / 2;

interface GaugeProps {
  value: number;
  limit: number;
  status: LimitStatus;
  size: number;
  label: string;
  sublabel: string;
}

const STATUS_COLOR = { within: 'positive', near: 'warning', breach: 'negative' } as const;

/** Map a value on [0, max] to an angle on the half circle. */
function angleFor(v: number, max: number): number {
  return START + (Math.min(Math.max(v, 0), max) / max) * (END - START);
}

/** Semicircular gauge (D3 arc generator). Scale runs from 0 to 2x the limit. */
function GaugeImpl({ value, limit, status, size, label, sublabel }: GaugeProps) {
  const max = limit * 2;
  const outer = size / 2;
  const inner = outer * 0.74;
  const angle = (v: number) => angleFor(v, max);

  const paths = useMemo(() => {
    const gen = arc<{ a0: number; a1: number }>()
      .innerRadius(inner)
      .outerRadius(outer)
      .startAngle((d) => d.a0)
      .endAngle((d) => d.a1)
      .cornerRadius(1);
    return {
      track: gen({ a0: START, a1: END }) ?? '',
      within: gen({ a0: START, a1: angleFor(limit * 0.75, max) }) ?? '',
      near: gen({ a0: angleFor(limit * 0.75, max), a1: angleFor(limit, max) }) ?? '',
      breach: gen({ a0: angleFor(limit, max), a1: END }) ?? '',
      value: gen({ a0: START, a1: angleFor(value, max) }) ?? '',
    };
  }, [inner, outer, limit, value, max]);

  const needle = angle(value);
  const nx = Math.sin(needle) * (outer + 2);
  const ny = -Math.cos(needle) * (outer + 2);
  const limitAngle = angle(limit);

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={outer + 6}
        viewBox={`${-outer - 4} ${-outer - 4} ${size + 8} ${outer + 10}`}
        aria-hidden="true"
      >
        <path d={paths.track} fill={cssColor('raised')} />
        <path d={paths.within} fill={cssColor('positive')} fillOpacity={0.14} />
        <path d={paths.near} fill={cssColor('warning')} fillOpacity={0.18} />
        <path d={paths.breach} fill={cssColor('negative')} fillOpacity={0.18} />
        <path d={paths.value} fill={cssColor(STATUS_COLOR[status])} />
        <line
          x1={Math.sin(limitAngle) * (inner - 4)}
          y1={-Math.cos(limitAngle) * (inner - 4)}
          x2={Math.sin(limitAngle) * (outer + 4)}
          y2={-Math.cos(limitAngle) * (outer + 4)}
          stroke={cssColor('text')}
          strokeWidth={1.5}
        />
        <line
          x1={0}
          y1={0}
          x2={nx * 0.7}
          y2={ny * 0.7}
          stroke={cssColor('text')}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <circle r={3} fill={cssColor('text')} />
      </svg>
      <span className="num -mt-0.5 text-xl font-semibold leading-tight text-fg">{label}</span>
      <span className="num text-2xs text-muted">{sublabel}</span>
    </div>
  );
}

export const Gauge = memo(GaugeImpl);
