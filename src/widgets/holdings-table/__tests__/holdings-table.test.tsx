import { fireEvent, render, screen } from '@testing-library/react';
import { VirtuosoMockContext } from 'react-virtuoso';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { holdingsTableDefinition, summarizeHoldings } from '../config';
import HoldingsTable from '../index';
import { selectHoldings, totals } from '../model';
import { configuredConfig, fixtureData } from './index';

const withViewport = (ui: ReactNode) => (
  <VirtuosoMockContext.Provider value={{ viewportHeight: 600, itemHeight: 32 }}>
    {ui}
  </VirtuosoMockContext.Provider>
);

describe('HoldingsTable', () => {
  const data = fixtureData();
  const defaults = holdingsTableDefinition.defaultConfig;

  it('sorts by weight descending by default and totals to 100%', () => {
    const rows = selectHoldings(data.holdings, defaults, '');
    expect(rows[0]?.weight).toBe(Math.max(...data.holdings.map((h) => h.weight)));
    expect(totals(rows).weight).toBeCloseTo(100, 6);
  });

  it('filters by sector and free text', () => {
    const fin = selectHoldings(data.holdings, configuredConfig, '');
    expect(fin.length).toBeGreaterThan(0);
    expect(fin.every((h) => h.sector === 'Financial Services')).toBe(true);
    const sorted = fin.map((h) => h.dailyPnLPercent);
    expect(sorted).toEqual([...sorted].sort((a, b) => a - b));
    expect(selectHoldings(data.holdings, defaults, 'reliance').map((h) => h.ticker)).toEqual([
      'RELIANCE',
    ]);
  });

  it('renders rows with right-aligned numbers and a total footer', () => {
    render(withViewport(<HoldingsTable {...widgetProps(defaults, data, 1000, 600)} />));
    expect(
      screen.getByText(`${data.holdings.length} of ${data.holdings.length}`),
    ).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(
      screen.getAllByRole('cell').find((c) => c.className.includes('text-right')),
    ).toBeDefined();
  });

  it('narrows the list as the user types', () => {
    render(withViewport(<HoldingsTable {...widgetProps(defaults, data, 1000, 600)} />));
    fireEvent.change(screen.getByRole('searchbox', { name: /Filter holdings/ }), {
      target: { value: 'bank' },
    });
    expect(screen.getByText(new RegExp(`^\\d+ of ${data.holdings.length}$`)).textContent).not.toBe(
      `${data.holdings.length} of ${data.holdings.length}`,
    );
  });

  it('toggles sort direction from the column header and exposes aria-sort', () => {
    const onConfigChange = vi.fn();
    render(
      withViewport(<HoldingsTable {...widgetProps(defaults, data, 1000, 600, onConfigChange)} />),
    );
    const header = screen.getByRole('columnheader', { name: /Weight/ });
    expect(header).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(screen.getByRole('button', { name: /Weight/ }));
    expect(onConfigChange).toHaveBeenCalledWith({ sortDir: 'asc' });
    fireEvent.click(screen.getByRole('button', { name: /Symbol/ }));
    expect(onConfigChange).toHaveBeenLastCalledWith({ sortBy: 'ticker', sortDir: 'asc' });
  });

  it('summarises value and P&L', () => {
    expect(summarizeHoldings(data, defaults)).toMatch(
      /^42 holdings, value ₹[\d,]+ Cr, day P&L [+−]₹/,
    );
  });
});
