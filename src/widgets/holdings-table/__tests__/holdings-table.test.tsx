import { fireEvent, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { VirtuosoMockContext } from 'react-virtuoso';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { generateStressHoldings } from '@/data/mock/stressHoldings';
import { applyPricesToHoldings } from '@/data/transformers';
import { subscribeWidgetEvents, type WidgetEvent } from '@/utils/widgetEvents';
import { holdingsTableDefinition, summarizeHoldings } from '../config';
import HoldingsTable from '../index';
import { sortedHoldings, totals } from '../model';
import type { HoldingsTableConfig } from '../types';
import { configuredConfig, emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = holdingsTableDefinition.defaultConfig;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

const withViewport = (ui: ReactNode) => (
  <VirtuosoMockContext.Provider value={{ viewportHeight: 600, itemHeight: 32 }}>
    {ui}
  </VirtuosoMockContext.Provider>
);

describe('HoldingsTable model', () => {
  it('sorts by weight descending by default and totals to 100%', () => {
    const rows = sortedHoldings(data.holdings, defaults);
    expect(rows[0]?.weight).toBe(Math.max(...data.holdings.map((h) => h.weight)));
    expect(totals(rows).weight).toBeCloseTo(100, 6);
  });

  it('applies the configured multi-key sort (sector, then day % descending)', () => {
    const rows = sortedHoldings(data.holdings, configuredConfig);
    for (let i = 1; i < rows.length; i += 1) {
      const a = rows[i - 1];
      const b = rows[i];
      if (!a || !b) continue;
      const sa = a.sector ?? '';
      const sb = b.sector ?? '';
      expect(sa.localeCompare(sb, 'en', { sensitivity: 'base' })).toBeLessThanOrEqual(0);
      if (sa === sb) expect(a.dailyPnLPercent).toBeGreaterThanOrEqual(b.dailyPnLPercent);
    }
  });

  it('applies live quotes to INR equities only; weights still sum to 100', () => {
    const stock = data.holdings.find((h) => h.assetClass === 'Equity' && h.currency === 'INR');
    const bond = data.holdings.find((h) => h.assetClass === 'Fixed Income');
    if (!stock || !bond) throw new Error('fixture lacks a stock or a bond');
    const price = stock.currentPrice * 1.02;
    const previousClose = stock.currentPrice;
    const next = applyPricesToHoldings(data.holdings, {
      type: 'prices',
      channel: 'ws://mock/portfolio/MER-IMAF-01/prices',
      seq: 1,
      sentAt: data.asOf,
      simulated: true,
      portfolioId: 'MER-IMAF-01',
      prices: [
        { ticker: stock.ticker, price, previousClose, changePct: 2 },
        { ticker: bond.ticker, price: 1, previousClose: 1, changePct: 0 },
      ],
    });
    const moved = next.find((h) => h.ticker === stock.ticker);
    expect(moved?.currentPrice).toBeCloseTo(price, 3);
    expect(moved?.marketValue).toBeCloseTo(stock.quantity * price, 1);
    expect(moved?.dailyPnL).toBeCloseTo(stock.quantity * (price - previousClose), 1);
    expect(next.find((h) => h.ticker === bond.ticker)?.currentPrice).toBe(bond.currentPrice);
    expect(sum(next.map((h) => h.weight))).toBeCloseTo(100, 2);
  });

  it('generates 1,000 deterministic demo rows whose weights sum to 100', () => {
    const a = generateStressHoldings(data.holdings, 1000);
    const b = generateStressHoldings(data.holdings, 1000);
    expect(a).toHaveLength(1000);
    expect(a.map((h) => h.quantity)).toEqual(b.map((h) => h.quantity));
    expect(new Set(a.map((h) => h.holdingId)).size).toBe(1000);
    expect(a.every((h) => h.name.includes('simulated row'))).toBe(true);
    expect(sum(a.map((h) => h.weight))).toBeCloseTo(100, 6);
  });

  it('summarises value and P&L', () => {
    expect(summarizeHoldings(data, defaults)).toMatch(
      /^62 holdings, value ₹[\d,]+ Cr, day P&L [+−]₹/,
    );
  });
});

describe('HoldingsTable', () => {
  it('shows the default columns, a live indicator and a total footer', () => {
    renderWithProviders(
      withViewport(<HoldingsTable {...widgetProps(defaults, data, 1000, 600)} />),
    );
    expect(screen.getByText('62 of 62')).toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual([
      'Ticker',
      'Name',
      'Qty',
      'Price',
      'Market value',
      'Day P&L',
      'Day P&L %',
      'Weight▼',
    ]);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText(/^(Live|Polling)$/)).toBeInTheDocument();
  });

  it('applies the configured order, hidden columns and pages', () => {
    renderWithProviders(
      withViewport(<HoldingsTable {...widgetProps(configuredConfig, data, 1000, 600)} />),
    );
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent ?? '');
    expect(headers.map((h) => h.replace(/[▲▼]\d?/g, ''))).toEqual([
      'Ticker',
      'Sector',
      'Day P&L %',
      'Day P&L',
      'Market value',
      'Weight',
      'Price',
    ]);
    expect(screen.getByRole('navigation', { name: 'Pages' })).toHaveTextContent('1–25 of 62');
  });

  it('saves a shift-click sort and a column change to the config', () => {
    const onConfigChange = vi.fn();
    renderWithProviders(
      withViewport(<HoldingsTable {...widgetProps(defaults, data, 1000, 600, onConfigChange)} />),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Ticker/ }), { shiftKey: true });
    expect(onConfigChange).toHaveBeenLastCalledWith({ sort: 'weight:desc,ticker:asc' });
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Columns' })).getByRole('checkbox', {
        name: 'Sector',
      }),
    );
    expect(onConfigChange).toHaveBeenLastCalledWith({ hiddenColumns: 'assetClass' });
  });

  it('publishes SYMBOL_SELECTED when a row is clicked', () => {
    const events: WidgetEvent[] = [];
    const stop = subscribeWidgetEvents((e) => events.push(e));
    renderWithProviders(
      withViewport(<HoldingsTable {...widgetProps(defaults, data, 1000, 600)} />),
    );
    const top = sortedHoldings(data.holdings, defaults)[0];
    if (!top) throw new Error('no rows');
    fireEvent.click(screen.getByRole('row', { name: `Select ${top.ticker}` }));
    stop();
    expect(events).toEqual([
      { type: 'SYMBOL_SELECTED', symbol: top.ticker, sourceInstanceId: 'test-instance' },
    ]);
  });

  it('switches to 1,000 generated rows for the performance demo', () => {
    renderWithProviders(
      withViewport(
        <HoldingsTable
          {...widgetProps<HoldingsTableConfig, typeof data>(
            { ...defaults, mockRows: '1000' },
            data,
            1000,
            600,
          )}
        />,
      ),
    );
    expect(screen.getByText('1,000 of 1,000')).toBeInTheDocument();
    expect(screen.getByText('Demo · 1,000 generated rows')).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeLessThan(80);
  });
});

describeWidgetStates('holdings-table', { data: fixtureData, emptyData });
