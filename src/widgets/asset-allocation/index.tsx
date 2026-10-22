import { memo, useCallback, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Segmented } from '@/components/FormControls';
import { seriesColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { env } from '@/utils/env';
import { formatMoneyCompact } from '@/utils/format';
import { buildSlices } from './model';
import type { AssetAllocationConfig, AssetAllocationData } from './types';

type View = AssetAllocationConfig['view'];

function AssetAllocation({
  onConfigChange,
  data,
  config,
  width,
  height,
}: WidgetComponentProps<AssetAllocationConfig, AssetAllocationData>) {
  const slices = useMemo(() => buildSlices(data, config), [data, config]);
  const [hovered, setHovered] = useState<number | null>(null);
  const total =
    config.view === 'asset-class' ? data.totalInr : slices.reduce((s, x) => s + x.valueInr, 0);
  const money = (inr: number) => formatMoneyCompact(inr, config.currency, env.VITE_USD_INR_RATE);
  const side = width > 420 && height < width * 0.9;
  const setView = useCallback((view: View) => onConfigChange({ view }), [onConfigChange]);
  const focus = hovered === null ? null : slices[hovered];

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end px-3 pt-2">
        <Segmented<View>
          label="Allocation breakdown"
          value={config.view}
          options={[
            { value: 'asset-class', label: 'Asset class' },
            { value: 'sector', label: 'Sector' },
          ]}
          onValueChange={setView}
        />
      </div>
      <div
        className={cx(
          'flex min-h-0 flex-1 gap-2 px-3 pb-2',
          side ? 'flex-row items-center' : 'flex-col',
        )}
      >
        <div className={cx('relative min-h-[96px]', side ? 'h-full w-1/2' : 'flex-1')}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="valueInr"
                nameKey="label"
                innerRadius="66%"
                outerRadius="92%"
                paddingAngle={1}
                stroke="rgb(var(--color-panel))"
                strokeWidth={1}
                isAnimationActive={false}
                onMouseEnter={(_, index) => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              >
                {slices.map((s, i) => (
                  <Cell
                    key={s.key}
                    fill={seriesColor(i)}
                    fillOpacity={hovered === null || hovered === i ? 1 : 0.35}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="max-w-[56%] truncate text-2xs uppercase tracking-wide text-muted">
              {focus ? focus.label : config.view === 'sector' ? 'Equity' : 'Total'}
            </span>
            <span className="num max-w-[60%] truncate text-xs font-semibold text-fg">
              {money(focus ? focus.valueInr : total)}
            </span>
            {focus ? (
              <span className="num text-2xs text-muted">{focus.weightPct.toFixed(1)}%</span>
            ) : null}
          </div>
        </div>
        {config.showLegend ? (
          <table className={cx('text-xs', side ? 'w-1/2' : 'w-full')}>
            <caption className="sr-only">Allocation breakdown</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Segment</th>
                <th scope="col">Value</th>
                <th scope="col">Weight</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((s, i) => (
                <tr
                  key={s.key}
                  className={cx('border-b border-line last:border-0', hovered === i && 'bg-raised')}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <th scope="row" className="py-0.5 pr-2 text-left font-normal text-fg">
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 shrink-0 rounded-sm"
                        style={{ background: seriesColor(i) }}
                      />
                      <span className="truncate">{s.label}</span>
                    </span>
                  </th>
                  <td className="num py-0.5 pr-2 text-right text-muted">{money(s.valueInr)}</td>
                  <td className="num py-0.5 text-right text-fg">{s.weightPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}

export default memo(AssetAllocation);
