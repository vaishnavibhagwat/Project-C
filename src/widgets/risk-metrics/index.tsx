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
  return (
    <div className="scroll-thin h-full overflow-y-auto p-2">
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-px overflow-hidden rounded bg-line">
        {tiles.map((t) => (
          <div key={t.key} className="flex flex-col gap-0.5 bg-panel px-2.5 py-2">
            <dt className="flex items-center gap-0.5 text-2xs font-medium uppercase tracking-wide text-muted">
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
