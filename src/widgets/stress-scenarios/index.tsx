import { memo, useMemo } from 'react';
import { Delta } from '@/components/Delta';
import type { WidgetComponentProps } from '@/types';
import { env } from '@/utils/env';
import { formatMoneyCompact } from '@/utils/format';
import { stressSummary, worstScenario } from './model';
import type { StressScenariosConfig, StressScenariosData } from './types';

function StressScenarios({
  data,
  config,
}: WidgetComponentProps<StressScenariosConfig, StressScenariosData>) {
  const worst = useMemo(() => worstScenario(data), [data]);
  const money = (inr: number) =>
    formatMoneyCompact(inr, config.currency, env.VITE_USD_INR_RATE, true);

  return (
    <div className="scroll-thin flex h-full flex-col overflow-y-auto">
      <p className="sr-only" role="status">
        {stressSummary(data)}
      </p>
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">
          Stress scenarios and their estimated impact on the portfolio
        </caption>
        <thead className="sticky top-0 bg-panel">
          <tr className="text-2xs uppercase tracking-wide text-muted">
            <th scope="col" className="px-3 py-1.5 text-left font-medium">
              Scenario
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              Impact
            </th>
            <th scope="col" className="px-3 py-1.5 text-right font-medium">
              % of NAV
            </th>
          </tr>
        </thead>
        <tbody>
          {data.scenarios.map((s) => (
            <tr
              key={s.id}
              className="border-t border-line align-top"
              data-worst={worst?.id === s.id ? 'true' : undefined}
            >
              <th scope="row" className="px-3 py-1.5 text-left font-normal">
                <span className="font-medium text-fg">
                  {s.name}
                  {worst?.id === s.id ? (
                    <span className="ml-1.5 rounded border border-neg/50 px-1 text-2xs text-neg">
                      Worst
                    </span>
                  ) : null}
                </span>
                <span className="block text-2xs text-muted">{s.description}</span>
                {config.showDetail ? (
                  <span className="mt-0.5 block text-2xs text-subtle">
                    {s.byAssetClass.map((a) => `${a.assetClass} ${money(a.impactInr)}`).join(' · ')}
                    {s.largest.length > 0
                      ? ` · Largest: ${s.largest.map((l) => `${l.ticker} ${money(l.impactInr)}`).join(', ')}`
                      : ''}
                  </span>
                ) : null}
              </th>
              <td className="num px-2 py-1.5 text-right">
                <Delta value={s.impactInr} text={money(s.impactInr)} arrow={false} />
              </td>
              <td className="num px-3 py-1.5 text-right">
                <Delta value={s.impactPct / 100} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-auto px-3 py-1 text-2xs text-subtle">
        Instantaneous, first-order estimates on today’s positions (beta, duration, FX). Simulated.
      </p>
    </div>
  );
}

export default memo(StressScenarios);
