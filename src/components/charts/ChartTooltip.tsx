import type { ReactNode } from 'react';

export interface TooltipRow {
  key: string;
  label: string;
  value: ReactNode;
  color?: string;
}

/** Compact crosshair tooltip body used by every Recharts chart. */
export function ChartTooltipBody({ title, rows }: { title: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="min-w-[160px] rounded border border-line-strong bg-raised px-2.5 py-2 text-xs shadow-lg">
      <div className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted">{title}</div>
      <dl className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-muted">
              {row.color ? (
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-3"
                  style={{ background: row.color }}
                />
              ) : null}
              {row.label}
            </dt>
            <dd className="num text-right text-fg">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Shared axis / grid styling: subtle gridlines, small tabular tick labels. */
export const AXIS_TICK = { fill: 'rgb(var(--color-text-subtle))', fontSize: 10 } as const;
export const GRID_STROKE = 'rgb(var(--color-border))';
export const CURSOR_STYLE = {
  stroke: 'rgb(var(--color-text-subtle))',
  strokeWidth: 1,
  strokeDasharray: '3 3',
} as const;

/**
 * How many points a line/area chart of this pixel width needs: about one per 3 px, capped.
 * Recharts work grows with point count, so this keeps renders cheap without visible loss.
 */
export function chartPointBudget(width: number): number {
  return Math.max(60, Math.min(300, Math.floor(width / 3) || 200));
}

/**
 * Fixed x-axis tick interval for a category axis. Passing a number stops Recharts from
 * measuring every label in the DOM to decide which ticks fit (one forced layout per label).
 */
export function xTickInterval(pointCount: number, width: number, labelPx = 96): number {
  const slots = Math.max(2, Math.floor(width / labelPx));
  return Math.max(0, Math.ceil(pointCount / slots) - 1);
}

/** Keep at most `max` points by striding, always keeping the final point. */
export function downsample<T>(points: readonly T[], max: number): T[] {
  if (points.length <= max) return [...points];
  const stride = points.length / max;
  const out: T[] = [];
  for (let i = 0; i < max - 1; i += 1) {
    const p = points[Math.floor(i * stride)];
    if (p !== undefined) out.push(p);
  }
  const last = points[points.length - 1];
  if (last !== undefined) out.push(last);
  return out;
}
