import { memo, useMemo } from 'react';
import { InfoTooltip } from '@/components/Tooltip';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { buildTiles } from './model';
import type { RiskMetricsConfig, RiskMetricsData } from './types';

const TONE_CLASS = { good: 'text-pos', bad: 'text-neg', neutral: 'text-fg' } as const;
const TONE_MARK = { good: '▲', bad: '▼', neutral: '' } as const;

function RiskMetrics({ data, config }: WidgetComponentProps<RiskMetricsConfig, RiskMetricsData>) {
  const tiles = useMemo(() => buildTiles(data, config), [data, config]);
  if (config.layout === 'table') {
    return (
      <div className="scroll-thin h-full overflow-y-auto">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">Risk-adjusted metrics</caption>
          <thead className="sticky top-0 bg-panel">
            <tr className="text-2xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-3 py-1.5 text-left font-medium">
                Metric
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Value
              </th>
              <th scope="col" className="px-3 py-1.5 text-left font-medium">
                Detail
              </th>
            </tr>
          </thead>
          <tbody>
            {tiles.map((t) => (
              <tr key={t.key} className="border-t border-line align-top">
                <th scope="row" className="px-3 py-1.5 text-left font-medium text-fg">
                  {t.label}
                  {config.showDefinitions ? (
                    <span className="block text-2xs font-normal text-muted">{t.definition}</span>
                  ) : null}
                </th>
                <td className={cx('num px-2 py-1.5 text-right font-semibold', TONE_CLASS[t.tone])}>
                  {TONE_MARK[t.tone] ? (
                    <span aria-hidden="true" className="mr-0.5 text-[0.7em]">
                      {TONE_MARK[t.tone]}
                    </span>
                  ) : null}
                  {t.value}
                </td>
                <td className="num px-3 py-1.5 text-2xs text-subtle">{t.detail ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="scroll-thin h-full overflow-y-auto p-2">
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
        {tiles.map((t) => (
          <div
            key={t.key}
            className="flex min-w-0 flex-col gap-0.5 rounded border border-line px-2.5 py-2"
          >
            <dt className="flex items-center gap-0.5 text-xs font-medium text-muted">
              <span className="truncate">{t.label}</span>
              <InfoTooltip content={t.definition} label={`About ${t.label}`} />
            </dt>
            <dd className={cx('num text-lg font-semibold leading-tight', TONE_CLASS[t.tone])}>
              {TONE_MARK[t.tone] ? (
                <span aria-hidden="true" className="mr-0.5 text-[0.6em] align-middle">
                  {TONE_MARK[t.tone]}
                </span>
              ) : null}
              {t.value}
            </dd>
            {config.showDefinitions && t.detail ? (
              <dd className="num truncate text-2xs text-subtle">{t.detail}</dd>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

export default memo(RiskMetrics);
