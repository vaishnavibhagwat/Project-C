import { memo, type ReactNode } from 'react';
import type { SkeletonVariant } from '@/registry/defineWidget';

const W = 240;
const H = 72;

/** Fixed pseudo-data so every thumbnail is identical between renders and builds. */
const WAVE = [0.62, 0.55, 0.58, 0.46, 0.5, 0.38, 0.42, 0.3, 0.34, 0.24, 0.28, 0.18];
const BARS = [0.55, 0.8, 0.35, 0.65, 0.9, 0.45, 0.7, 0.3];
const HEAT = [0.2, 0.7, 0.45, 0.9, 0.1, 0.6, 0.35, 0.8, 0.55, 0.25, 0.75, 0.4];

const linePath = (pts: readonly number[]) =>
  pts
    .map(
      (v, i) =>
        `${i === 0 ? 'M' : 'L'}${8 + (i * (W - 16)) / (pts.length - 1)},${8 + v * (H - 16)}`,
    )
    .join(' ');

function shapes(variant: SkeletonVariant): ReactNode {
  switch (variant) {
    case 'line-chart':
      return (
        <>
          <path d={linePath(WAVE)} fill="none" stroke="currentColor" strokeWidth={2} />
          <path
            d={linePath(WAVE.map((v) => Math.min(0.9, v + 0.12)))}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.5}
          />
        </>
      );
    case 'area-chart':
      return (
        <>
          <path
            d={`${linePath(WAVE)} L${W - 8},${H - 8} L8,${H - 8} Z`}
            fill="currentColor"
            opacity={0.25}
          />
          <path d={linePath(WAVE)} fill="none" stroke="currentColor" strokeWidth={2} />
        </>
      );
    case 'donut':
      return (
        <>
          <circle
            cx={W / 2}
            cy={H / 2}
            r={24}
            fill="none"
            stroke="currentColor"
            strokeWidth={10}
            opacity={0.3}
          />
          <circle
            cx={W / 2}
            cy={H / 2}
            r={24}
            fill="none"
            stroke="currentColor"
            strokeWidth={10}
            strokeDasharray="60 151"
          />
        </>
      );
    case 'bars':
      return BARS.map((v, i) => (
        <rect
          key={i}
          x={16 + i * 27}
          y={H - 8 - v * (H - 16)}
          width={16}
          height={v * (H - 16)}
          fill="currentColor"
          opacity={i % 3 === 1 ? 0.45 : 0.8}
        />
      ));
    case 'gauge':
      return (
        <>
          <path
            d={`M${W / 2 - 40},${H - 8} A40,40 0 0 1 ${W / 2 + 40},${H - 8}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={8}
            opacity={0.3}
          />
          <path
            d={`M${W / 2 - 40},${H - 8} A40,40 0 0 1 ${W / 2 + 12},${H - 46}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={8}
          />
        </>
      );
    case 'heatmap':
      return HEAT.map((v, i) => (
        <rect
          key={i}
          x={8 + (i % 6) * 38}
          y={8 + Math.floor(i / 6) * 28}
          width={34}
          height={24}
          fill="currentColor"
          opacity={0.15 + v * 0.75}
        />
      ));
    case 'treemap':
      return (
        <>
          <rect x={8} y={8} width={110} height={56} fill="currentColor" opacity={0.8} />
          <rect x={122} y={8} width={64} height={32} fill="currentColor" opacity={0.55} />
          <rect x={122} y={44} width={64} height={20} fill="currentColor" opacity={0.35} />
          <rect x={190} y={8} width={42} height={56} fill="currentColor" opacity={0.45} />
        </>
      );
    case 'tiles':
      return [0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={8 + i * 76}
            y={12}
            width={68}
            height={48}
            rx={3}
            fill="currentColor"
            opacity={0.15}
          />
          <rect x={16 + i * 76} y={22} width={30} height={5} fill="currentColor" opacity={0.5} />
          <rect x={16 + i * 76} y={36} width={46} height={10} fill="currentColor" />
        </g>
      ));
    case 'feed':
      return [0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={8} y={10 + i * 20} width={40} height={4} fill="currentColor" opacity={0.45} />
          <rect
            x={8}
            y={17 + i * 20}
            width={150 + ((i * 37) % 60)}
            height={6}
            fill="currentColor"
          />
        </g>
      ));
    case 'table':
      return [0, 1, 2, 3, 4].map((i) => (
        <g key={i} opacity={i === 0 ? 0.5 : 0.85}>
          <rect x={8} y={8 + i * 12} width={56} height={6} fill="currentColor" />
          <rect x={120} y={8 + i * 12} width={40} height={6} fill="currentColor" />
          <rect x={180} y={8 + i * 12} width={52} height={6} fill="currentColor" />
        </g>
      ));
  }
}

/** Schematic thumbnail of a widget's layout (drawn from its skeleton shape, not live data). */
export const WidgetPreview = memo(function WidgetPreview({
  variant,
}: {
  variant: SkeletonVariant;
}) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[72px] w-full rounded bg-raised text-accent"
      aria-hidden="true"
      data-testid={`preview-${variant}`}
    >
      {shapes(variant)}
    </svg>
  );
});
