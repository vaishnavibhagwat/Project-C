import { useMemo } from 'react';
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { AXIS_TICK, ChartTooltipBody, GRID_STROKE } from '@/components/charts';
import { Modal } from '@/components/Overlay';
import { cssColor } from '@/theme/themes';
import { formatPct } from '@/utils/format';
import { formatDateKey } from '@/utils/time';
import { formatCorrelation, pairStats } from './model';
import type { ReturnSeries } from './types';

interface ScatterModalProps {
  a: ReturnSeries;
  b: ReturnSeries;
  dates: readonly string[];
  onClose: () => void;
}

type Point = { x: number; y: number; date: string };

function isPoint(v: unknown): v is Point {
  return (
    typeof v === 'object' &&
    v !== null &&
    'x' in v &&
    'y' in v &&
    'date' in v &&
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    typeof v.date === 'string'
  );
}

function PointTooltip({
  active,
  payload,
  a,
  b,
}: TooltipProps<number, string> & { a: string; b: string }) {
  const point: unknown = payload?.[0]?.payload;
  if (!active || !isPoint(point)) return null;
  return (
    <ChartTooltipBody
      title={point.date ? formatDateKey(point.date) : ''}
      rows={[
        { key: 'a', label: a, value: formatPct(point.x, 2) },
        { key: 'b', label: b, value: formatPct(point.y, 2) },
      ]}
    />
  );
}

/** Daily returns of two assets against each other, with the least-squares line. */
export function ScatterModal({ a, b, dates, onClose }: ScatterModalProps) {
  const stats = useMemo(() => pairStats(a, b, dates), [a, b, dates]);
  const xs = stats.points.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const my = stats.points.reduce((s, p) => s + p.y, 0) / Math.max(1, stats.days);
  const mx = xs.reduce((s, x) => s + x, 0) / Math.max(1, stats.days);
  const line = (x: number) => my + stats.beta * (x - mx);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <Modal
      open
      onClose={onClose}
      title={`${a.label} vs ${b.label}`}
      description={`Daily returns over the last ${stats.days} trading days (simulated).`}
      size="lg"
    >
      <dl className="mb-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted">Correlation</dt>
          <dd className="num text-base font-semibold text-fg">
            {formatCorrelation(stats.correlation)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">
            Beta of {b.label} to {a.label}
          </dt>
          <dd className="num text-base font-semibold text-fg">{stats.beta.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-muted">Days</dt>
          <dd className="num text-base font-semibold text-fg">{stats.days}</dd>
        </div>
      </dl>
      <div className="h-72" data-testid="pair-scatter">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 18, left: 4 }}>
            <CartesianGrid stroke={GRID_STROKE} />
            <XAxis
              type="number"
              dataKey="x"
              name={a.label}
              tick={AXIS_TICK}
              tickFormatter={pct}
              domain={['auto', 'auto']}
              label={{
                value: `${a.label} daily return`,
                position: 'insideBottom',
                offset: -10,
                fill: cssColor('textMuted'),
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={b.label}
              tick={AXIS_TICK}
              tickFormatter={pct}
              width={48}
              domain={['auto', 'auto']}
              label={{
                value: b.label,
                angle: -90,
                position: 'insideLeft',
                fill: cssColor('textMuted'),
                fontSize: 11,
              }}
            />
            <ReferenceLine x={0} stroke={cssColor('borderStrong')} />
            <ReferenceLine y={0} stroke={cssColor('borderStrong')} />
            <ReferenceLine
              segment={[
                { x: xMin, y: line(xMin) },
                { x: xMax, y: line(xMax) },
              ]}
              stroke={cssColor('accent')}
              strokeDasharray="4 3"
              ifOverflow="extendDomain"
            />
            <Tooltip isAnimationActive={false} content={<PointTooltip a={a.label} b={b.label} />} />
            <Scatter
              data={stats.points}
              fill={cssColor('chart2')}
              fillOpacity={0.6}
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-2xs text-muted">
        Each dot is one trading day. Dashed line: least-squares fit (slope = beta).
      </p>
    </Modal>
  );
}
