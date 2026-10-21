import { render, screen } from '@testing-library/react';
import { VirtuosoMockContext } from 'react-virtuoso';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { settlementDate } from '@/utils/time';
import { summarizeBlotter, tradeBlotterDefinition } from '../config';
import TradeBlotter from '../index';
import { filterTrades, flows } from '../model';
import { configuredConfig, fixtureData } from './index';

describe('TradeBlotter', () => {
  const data = fixtureData();
  const defaults = tradeBlotterDefinition.defaultConfig;

  it('settles every trade on T+1', () => {
    for (const t of data.trades) expect(t.settlementDate).toBe(settlementDate(t.tradeDate));
  });

  it('filters by side and computes buy/sell flows', () => {
    const buys = filterTrades(data.trades, configuredConfig);
    expect(buys.every((t) => t.side === 'BUY')).toBe(true);
    const f = flows(data.trades);
    expect(f.net).toBeCloseTo(f.buy - f.sell, 2);
  });

  it('labels side with text and arrow, not colour alone', () => {
    render(
      <VirtuosoMockContext.Provider value={{ viewportHeight: 600, itemHeight: 32 }}>
        <TradeBlotter {...widgetProps(defaults, data, 1000, 600)} />
      </VirtuosoMockContext.Provider>,
    );
    expect(screen.getAllByText(/^▲ BUY$|^▼ SELL$/).length).toBeGreaterThan(0);
    expect(screen.getByRole('columnheader', { name: 'Settles (T+1)' })).toBeInTheDocument();
  });

  it('summarises the latest execution', () => {
    expect(summarizeBlotter(data, defaults)).toMatch(/Latest: (BUY|SELL) \d+ [A-Z&-]+ at ₹/);
  });
});
