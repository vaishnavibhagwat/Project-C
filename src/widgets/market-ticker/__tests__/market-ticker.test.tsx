import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FIXTURE_TIME, fixture } from '@/__tests__/fixtures';
import { renderWithProviders, widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { istTimeMs } from '@/utils/time';
import { marketTickerDefinition, summarizeMarketTicker } from '../config';
import MarketTicker from '../index';
import {
  crawlSeconds,
  directionOf,
  formatChange,
  nseStatus,
  quoteLabel,
  selectQuotes,
  sparkPoints,
} from '../model';
import { configuredConfig, emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = marketTickerDefinition.defaultConfig;
const bySymbol = (s: string) => data.quotes.find((q) => q.symbol === s);

describe('market/ticker data', () => {
  it('quotes the eight instruments from the portfolio model', () => {
    expect(data.quotes.map((q) => q.symbol)).toEqual([
      'NIFTY50',
      'SENSEX',
      'SPX',
      'FTSE',
      'USDINR',
      'EURUSD',
      'GOLD',
      'CRUDE',
    ]);
    for (const q of data.quotes) {
      expect(q.changePct).toBeCloseTo((q.price / q.previousClose - 1) * 100, 2);
      expect(q.history.length).toBeGreaterThanOrEqual(30);
    }
  });

  it('moves the Nifty with the live tape during the session; USD/INR is the fixed rate', () => {
    // FIXTURE_TIME is 11:42 IST on a trading day: the NSE tape is running.
    expect(bySymbol('NIFTY50')?.live).toBe(true);
    expect(bySymbol('SENSEX')?.changePct).toBeCloseTo(bySymbol('NIFTY50')?.changePct ?? NaN, 2);
    expect(bySymbol('SPX')?.live).toBe(false);
    const usdinr = bySymbol('USDINR');
    expect(usdinr?.price).toBe(83.5);
    expect(usdinr?.changePct).toBe(0);
    expect(usdinr?.note).toMatch(/Fixed valuation rate/);
    // Later in the same session the Nifty has moved; closes-based quotes have not.
    const later = fixture('market/ticker', FIXTURE_TIME + 30 * 60_000);
    const spxLater = later.quotes.find((q) => q.symbol === 'SPX');
    expect(spxLater?.price).toBe(bySymbol('SPX')?.price);
  });
});

describe('MarketTicker model', () => {
  it('shows NSE pre-open, open and closed from the IST clock', () => {
    const day = '2026-11-05';
    expect(nseStatus(istTimeMs(day, 8, 59)).status).toBe('closed');
    expect(nseStatus(istTimeMs(day, 9, 5)).status).toBe('pre-open');
    expect(nseStatus(istTimeMs(day, 9, 15)).status).toBe('open');
    expect(nseStatus(istTimeMs(day, 15, 29)).status).toBe('open');
    expect(nseStatus(istTimeMs(day, 15, 30)).status).toBe('closed');
    expect(nseStatus(istTimeMs('2026-11-07', 11, 0)).label).toMatch(/Weekend/);
  });

  it('filters symbols, signs changes and sizes the loop', () => {
    expect(selectQuotes(data, configuredConfig).map((q) => q.symbol)).toEqual([
      'NIFTY50',
      'SPX',
      'USDINR',
      'GOLD',
    ]);
    expect([directionOf(0.3), directionOf(-0.3), directionOf(0)]).toEqual(['up', 'down', 'flat']);
    expect(formatChange(-1.234)).toBe('−1.23%');
    expect(formatChange(0.5)).toBe('+0.50%');
    expect(crawlSeconds(8, 'normal')).toBe(24);
    expect(crawlSeconds(1, 'fast')).toBe(6);
    expect(sparkPoints([1, 2, 3], 60, 16).split(' ')).toHaveLength(3);
    const nifty = bySymbol('NIFTY50');
    if (nifty) expect(quoteLabel(nifty)).toMatch(/^Nifty 50 [\d,]+\.\d\d, (up|down|unchanged)/);
  });

  it('summarises the visible quotes', () => {
    expect(summarizeMarketTicker(data, configuredConfig)).toMatch(
      /^Nifty 50 [\d,.]+ [+−]?\d+\.\d\d%; S&P 500 .+; USD\/INR 83\.50 0\.00%; Gold \(USD\/oz\) .+$/,
    );
  });
});

describe('MarketTicker', () => {
  it('crawls with a CSS transform animation over two copies, the second hidden', () => {
    renderWithProviders(<MarketTicker {...widgetProps(defaults, data, 700, 30)} />);
    const track = screen.getByTestId('ticker-track');
    expect(track.className).toContain('animate-ticker-crawl');
    expect(track.className).toContain('motion-reduce:animate-none');
    expect(track.style.animationDuration).toBe('24s');
    const lists = track.querySelectorAll('ul');
    expect(lists).toHaveLength(2);
    expect(lists[1]).toHaveAttribute('aria-hidden', 'true');
    expect(
      within(lists[1] as HTMLElement).getAllByRole('button', { hidden: true })[0],
    ).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('list', { name: 'Instruments' }).children).toHaveLength(8);
  });

  it('has a visible Pause / Play button and pauses on hover and focus', () => {
    renderWithProviders(<MarketTicker {...widgetProps(defaults, data, 700, 30)} />);
    const track = screen.getByTestId('ticker-track');
    expect(track.className).toContain('group-hover:[animation-play-state:paused]');

    fireEvent.click(screen.getByRole('button', { name: 'Pause the ticker' }));
    expect(track.style.animationPlayState).toBe('paused');
    expect(screen.getByRole('button', { name: 'Play the ticker' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play the ticker' }));
    expect(track.style.animationPlayState).toBe('');
  });

  it('stops crawling and becomes a scrolling row while keyboard focus is inside', () => {
    renderWithProviders(<MarketTicker {...widgetProps(defaults, data, 700, 30)} />);
    const track = screen.getByTestId('ticker-track');
    const item = within(screen.getByRole('list', { name: 'Instruments' })).getAllByRole(
      'button',
    )[0];
    if (!item) throw new Error('no items');
    fireEvent.focus(item);
    expect(track).toHaveAttribute('data-static', 'true');
    expect(track.className).not.toContain('animate-ticker-crawl');
    fireEvent.blur(item, { relatedTarget: document.body });
    expect(track.className).toContain('animate-ticker-crawl');
  });

  it('shows arrows as well as colour, and expands a sparkline on click', () => {
    renderWithProviders(<MarketTicker {...widgetProps(defaults, data, 700, 30)} />);
    const list = screen.getByRole('list', { name: 'Instruments' });
    expect(within(list).getAllByText(/^[▲▼■]/).length).toBe(8);
    const nifty = within(list).getByRole('button', { name: /^Nifty 50 / });
    expect(nifty).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(nifty);
    expect(nifty).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('spark-NIFTY50').querySelector('polyline')).not.toBeNull();
  });

  it('shows the NSE session status as text', () => {
    renderWithProviders(<MarketTicker {...widgetProps(defaults, data, 700, 30)} />);
    expect(screen.getByText(/^NSE (Open|Pre-open|Closed)/)).toBeInTheDocument();
  });
});

describeWidgetStates('market-ticker', { data: fixtureData, emptyData });
