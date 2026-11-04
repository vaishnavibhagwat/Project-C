import { describe, expect, it } from 'vitest';
import { LIMITS } from '@/data/derive/alerts';
import { mockWorld } from '@/data/mock';
import { holdingsResponse, portfolioResponse } from '@/data/mock/responses';
import { closeValueInr, getPortfolioModel, modelStats } from '@/data/model';
import { buildSummaryTiles, toSummaryStripData } from '@/layout/summaryStrip';
import { totals } from '@/widgets/holdings-table/model';
import { fixture, FIXTURE_TIME } from './fixtures';

/**
 * Every widget reads one portfolio model (src/data/model.ts). These tests check that the
 * numbers line up across endpoints: weights, the summary strip and the holdings table, risk
 * figures and the REST-style mock API.
 */

const model = getPortfolioModel(FIXTURE_TIME);
const holdings = fixture('portfolio/holdings');
const allocation = fixture('portfolio/allocation');
const summary = fixture('portfolio/summary');
const metrics = fixture('risk/metrics');
const risk = fixture('risk/var');
const strip = toSummaryStripData(summary, metrics, risk, LIMITS.var99Critical);
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

describe('one portfolio model, consistent numbers', () => {
  it('holding weights sum to 100%, and so do asset classes, geographies and sectors', () => {
    expect(sum(holdings.holdings.map((h) => h.weight))).toBeCloseTo(100, 6);
    expect(sum(allocation.assetClasses.map((a) => a.weightPct))).toBeCloseTo(100, 6);
    expect(sum(allocation.geographies.map((g) => g.weightPct))).toBeCloseTo(100, 6);
    expect(sum(allocation.sectors.map((s) => s.weightPct))).toBeCloseTo(100, 6);
  });

  it('the book totals USD 45.0B at the last close', () => {
    const atClose = sum(model.positions.map((p) => closeValueInr(p, model.fxUsdInr)));
    expect(Math.abs(atClose - model.aumInr)).toBeLessThan(1);
    expect(summary.aumUsd).toBe(45_000_000_000);
    const aumTile = buildSummaryTiles(strip).find((t) => t.id === 'aum');
    expect(aumTile?.value.text).toBe('$45.0B');
  });

  it('summary strip totals match the holdings table', () => {
    const table = totals(holdings.holdings);
    expect(holdings.holdings).toHaveLength(model.positions.length);
    // Intraday market value: AUM x (1 + change) on the strip = sum of the table's values.
    expect(strip.aumInr * (1 + strip.intradayChange)).toBeCloseTo(table.marketValue, -1);
    expect(summary.marketValueInr).toBeCloseTo(table.marketValue, -1);
    expect(holdings.totalMarketValue).toBeCloseTo(table.marketValue, -1);
    // Day P&L tile = the table's Day P&L total.
    expect(strip.dailyPnlInr).toBeCloseTo(table.dailyPnL, -1);
    expect(strip.dailyPnlChange * 100).toBeCloseTo(
      (table.dailyPnL / (table.marketValue - table.dailyPnL)) * 100,
      3,
    );
    expect(table.weight).toBeCloseTo(100, 6);
    expect(summary.holdingsCount).toBe(holdings.holdings.length);
  });

  it('asset-class weights on the overview agree with the holdings', () => {
    const equity = sum(
      holdings.holdings.filter((h) => h.assetClass === 'Equity').map((h) => h.weight),
    );
    expect(summary.equityWeightPct).toBeCloseTo(equity, 4);
    expect(allocation.assetClasses.find((a) => a.id === 'equity')?.weightPct).toBeCloseTo(
      equity,
      4,
    );
  });

  it('Sharpe, volatility, VaR and drawdown on the strip come from the model statistics', () => {
    const stats = modelStats(model);
    expect(strip.sharpe).toBeCloseTo(stats.sharpe, 3);
    expect(strip.volatility).toBeCloseTo(stats.volatility, 5);
    expect(strip.var99).toBeCloseTo(stats.var.historical.var99, 5);
    expect(strip.maxDrawdown).toBeCloseTo(stats.drawdown.depth, 5);
    expect(risk.parametric.var95).toBeCloseTo(stats.var.parametric.var95, 5);
    // The model's NAV is the only NAV: the nav-history widget plots the same series.
    const nav = fixture('portfolio/nav-history').points.map((p) => p.nav);
    expect(nav.at(-1)).toBeCloseTo(model.fundNav.at(-1) ?? 0, 3);
  });

  it('the REST-style mock API serves the same book at the last close', () => {
    const world = mockWorld(model);
    const api = holdingsResponse(world);
    expect(api.holdings).toHaveLength(holdings.holdings.length);
    expect(Math.abs(api.totalValueInr - model.aumInr)).toBeLessThan(1);
    const byTicker = new Map(holdings.holdings.map((h) => [h.ticker, h]));
    for (const h of api.holdings) expect(byTicker.get(h.ticker)?.quantity).toBe(h.quantity);
    const portfolio = portfolioResponse(world);
    expect(portfolio.aumUsd).toBeCloseTo(45e9, -3);
    expect(sum(portfolio.assetClasses.map((a) => a.weightPct))).toBeCloseTo(100, 1);
  });
});
