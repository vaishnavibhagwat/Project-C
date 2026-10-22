import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIMITS } from '@/data/derive/alerts';
import { EndpointFetcherContext, type EndpointFetcher } from '@/hooks/useEndpoint';
import { PortfolioSummaryStrip, PortfolioSummaryStripView } from '@/layout/PortfolioSummaryStrip';
import {
  buildSummaryTiles,
  PLACEHOLDER_SUMMARY_STRIP,
  toSummaryStripData,
  type SummaryStripData,
} from '@/layout/summaryStrip';
import { formatPct } from '@/utils/format';
import { fixture } from './fixtures';
import { renderWithProviders } from './render';

const P = PLACEHOLDER_SUMMARY_STRIP;
const tileById = (data: SummaryStripData) =>
  new Map(buildSummaryTiles(data).map((tile) => [tile.id, tile]));

/** The <div> group for one metric in the rendered strip. */
function metric(id: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-metric="${id}"]`);
  if (!el) throw new Error(`metric ${id} not rendered`);
  return el;
}

describe('summary strip model', () => {
  it('builds the eight tiles in order with formatted values and comparison periods', () => {
    const tiles = buildSummaryTiles(P);
    expect(tiles.map((t) => t.label)).toEqual([
      'AUM',
      'Daily P&L',
      'MTD return',
      'YTD return',
      'Sharpe ratio',
      'Volatility',
      'VaR 99% · 1d',
      'Max drawdown',
    ]);
    const t = tileById(P);
    expect(t.get('aum')?.value.text).toBe('$45.0B');
    expect(t.get('dailyPnl')?.value).toEqual({ text: '+₹1,578 Cr', signed: P.dailyPnlInr });
    expect(t.get('mtd')?.comparison.text).toBe('since 1 Oct');
    expect(t.get('ytd')?.comparison.text).toBe('since 1 Jan 2026');
    expect(t.get('maxDrawdown')?.value.text).toBe('−35.3%');
    expect(t.get('maxDrawdown')?.comparison.text).toBe('since Sep 2021 · now −0.4%');
    for (const tile of tiles) expect(tile.tooltip.length).toBeGreaterThan(40);
  });

  it('marks lower volatility and VaR under the limit as good news', () => {
    const t = tileById(P);
    expect(t.get('volatility')?.comparison.change).toMatchObject({
      text: '11.8%',
      goodWhen: 'down',
    });
    expect(t.get('volatility')?.comparison.change?.amount).toBeLessThan(0);
    expect(t.get('var')?.comparison).toMatchObject({
      text: 'under 2.0% limit',
      change: { text: '0.34 pts', goodWhen: 'down' },
    });
    const over = tileById({ ...P, var99: 0.023 }).get('var');
    expect(over?.comparison.text).toBe('over 2.0% limit');
    expect(over?.comparison.change?.amount).toBeGreaterThan(0);
  });

  it('builds the strip from the shared mock dataset', () => {
    const summary = fixture('portfolio/summary');
    const metrics = fixture('risk/metrics');
    const risk = fixture('risk/var');
    const d = toSummaryStripData(summary, metrics, risk, LIMITS.var99Critical);
    expect(d.aumUsd).toBe(45_000_000_000);
    expect(d.dailyPnlInr).toBe(summary.dailyPnL);
    expect(d.mtdReturn).toBeCloseTo(summary.mtdReturn / 100, 10);
    expect(d.sharpe).toBe(summary.sharpeRatio);
    expect(d.volatility).toBe(metrics.annualVolatility);
    expect(d.var99Inr).toBeCloseTo(risk.historical.var99 * risk.portfolioValueInr, 0);
    expect(d.maxDrawdown).toBe(metrics.maxDrawdown);
    expect(d.varLimit).toBe(0.02);
  });
});

describe('PortfolioSummaryStripView', () => {
  it('shows each metric with tabular figures, signs, arrows and emerald/coral tones', () => {
    render(<PortfolioSummaryStripView data={P} />);
    const strip = screen.getByRole('region', { name: /^Portfolio summary, as of 11:42:00 IST/ });
    expect(within(strip).getAllByRole('term')).toHaveLength(8);

    const pnl = within(metric('dailyPnl')).getAllByRole('definition');
    expect(pnl[0]).toHaveTextContent('▲+₹1,578 Cr');
    expect(pnl[0]).toHaveClass('num', 'text-pos');

    const vol = within(metric('volatility')).getByText('11.8%');
    expect(vol).toHaveClass('text-pos');
    expect(vol).toHaveTextContent('▼lower: 11.8%');

    const dd = within(metric('maxDrawdown')).getAllByRole('definition')[0];
    expect(dd).toHaveTextContent('▼−35.3%');
    expect(dd).toHaveClass('text-neg');
  });

  it('turns coral on a down day', () => {
    render(
      <PortfolioSummaryStripView
        data={{ ...P, dailyPnlInr: -7_140_000_000, dailyPnlChange: -0.0019, mtdReturn: -0.012 }}
      />,
    );
    expect(within(metric('dailyPnl')).getAllByRole('definition')[0]).toHaveClass('text-neg');
    expect(within(metric('dailyPnl')).getByText('−0.19%')).toHaveClass('text-neg');
    expect(within(metric('mtd')).getAllByRole('definition')[0]).toHaveTextContent('▼−1.20%');
  });

  it('explains each metric in a tooltip', () => {
    render(<PortfolioSummaryStripView data={P} />);
    fireEvent.click(screen.getByRole('button', { name: 'About Sharpe ratio' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/risk-free rate.*last 12 months/);
  });

  it('shows a shaped skeleton while loading', () => {
    render(<PortfolioSummaryStripView data={undefined} />);
    const strip = screen.getByRole('region', { name: 'Portfolio summary' });
    expect(strip).toHaveAttribute('aria-busy', 'true');
    expect(strip.querySelectorAll('.skeleton')).toHaveLength(24);
    expect(within(strip).queryAllByRole('term')).toHaveLength(0);
  });

  it('shows an error with Retry, or the disconnected message', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <PortfolioSummaryStripView
        data={undefined}
        error={new Error('GET /api/risk/var returned 503')}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/returned 503/);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<PortfolioSummaryStripView data={undefined} disconnected onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Feed disconnected/);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});

describe('PortfolioSummaryStrip (wired)', () => {
  it('reads the same cached endpoints as the widgets', async () => {
    const fetcher: EndpointFetcher = (endpoint) => Promise.resolve(fixture(endpoint));
    renderWithProviders(
      <EndpointFetcherContext.Provider value={fetcher}>
        <PortfolioSummaryStrip />
      </EndpointFetcherContext.Provider>,
    );
    expect(await screen.findByText('$45.0B')).toBeInTheDocument();
    const var99 = fixture('risk/var').historical.var99;
    expect(within(metric('var')).getByText(formatPct(var99, 2, false))).toBeInTheDocument();
  });
});
