import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { RiskSettingsContext } from '@/hooks/useRiskSettings';
import { riskContributionDefinition } from '../config';
import RiskContribution from '../index';
import { contributionRows, contributionSummary, portfolioVar, Z_SCORE } from '../model';
import { emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = riskContributionDefinition.defaultConfig;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe('RiskContribution model', () => {
  it('component VaRs over all positions add up to the portfolio VaR', () => {
    const basis = { confidence: '99', horizonDays: 1 } as const;
    const all = contributionRows(data, basis, data.positions.length);
    expect(sum(all.map((r) => r.varInr))).toBeCloseTo(portfolioVar(data, basis), -3);
    expect(sum(all.map((r) => r.sharePct))).toBeCloseTo(100, 2);
  });

  it('scales by the z-score and the square root of the horizon', () => {
    const one = portfolioVar(data, { confidence: '95', horizonDays: 1 });
    const ten = portfolioVar(data, { confidence: '95', horizonDays: 10 });
    expect(ten / one).toBeCloseTo(Math.sqrt(10), 10);
    const n99 = portfolioVar(data, { confidence: '99', horizonDays: 1 });
    expect(n99 / one).toBeCloseTo(Z_SCORE['99'] / Z_SCORE['95'], 10);
  });

  it('summarises the largest shares', () => {
    expect(contributionSummary(data, { confidence: '99', horizonDays: 1 }, 15)).toMatch(
      /^99% 1-day parametric VaR ₹[\d,.]+ (Cr|L)\. Largest shares of risk: .+\. \d+ positions reduce risk\.$/,
    );
  });
});

describe('RiskContribution', () => {
  it('uses its own settings off the Risk page', () => {
    renderWithProviders(<RiskContribution {...widgetProps(defaults, data, 600, 400)} />);
    expect(screen.getByText(/^99% 1-day VaR/)).toBeInTheDocument();
    expect(screen.queryByText(/page setting/)).not.toBeInTheDocument();
  });

  it('follows the Risk page’s confidence and horizon', () => {
    const page = ({ children }: { children: ReactNode }) => (
      <RiskSettingsContext.Provider value={{ confidence: '95', horizonDays: 10 }}>
        {children}
      </RiskSettingsContext.Provider>
    );
    renderWithProviders(<RiskContribution {...widgetProps(defaults, data, 600, 400)} />, {
      wrapper: page,
    });
    expect(screen.getByText(/^95% 10-day VaR/)).toBeInTheDocument();
    expect(screen.getByText(/page setting/)).toBeInTheDocument();
  });
});

describeWidgetStates('risk-contribution', { data: fixtureData, emptyData });
