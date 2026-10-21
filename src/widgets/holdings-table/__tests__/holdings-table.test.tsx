import { fireEvent, render, screen } from '@testing-library/react';
import { VirtuosoMockContext } from 'react-virtuoso';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { useWidgetStore } from '@/store/widgetStore';
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
    expect(rows[0]?.weightPct).toBe(Math.max(...data.holdings.map((h) => h.weightPct)));
    expect(totals(rows).weightPct).toBeCloseTo(100, 6);
  });

  it('filters by sector and free text', () => {
    const fin = selectHoldings(data.holdings, configuredConfig, '');
    expect(fin.length).toBeGreaterThan(0);
    expect(fin.every((h) => h.sector === 'Financial Services')).toBe(true);
    const sorted = fin.map((h) => h.dayChangePct);
    expect(sorted).toEqual([...sorted].sort((a, b) => a - b));
    expect(selectHoldings(data.holdings, defaults, 'reliance').map((h) => h.symbol)).toEqual([
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
    const id = 'holdings-holdings-table';
    render(
      withViewport(<HoldingsTable {...widgetProps(defaults, data, 1000, 600)} instanceId={id} />),
    );
    const header = screen.getByRole('columnheader', { name: /Weight/ });
    expect(header).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(screen.getByRole('button', { name: /Weight/ }));
    expect(useWidgetStore.getState().instances[id]?.config.sortDir).toBe('asc');
  });

  it('summarises value and P&L', () => {
    expect(summarizeHoldings(data, defaults)).toMatch(
      /^42 holdings, value ₹[\d,]+ Cr, day P&L [+−]₹/,
    );
  });
});
