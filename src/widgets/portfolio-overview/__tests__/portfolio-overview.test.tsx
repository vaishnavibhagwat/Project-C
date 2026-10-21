import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { portfolioOverviewDefinition, summarizePortfolioOverview } from '../config';
import PortfolioOverview from '../index';
import { configuredConfig, fixtureData } from './index';

describe('PortfolioOverview', () => {
  const data = fixtureData();

  it('shows AUM of exactly USD 45.0B at the last close, in INR first by default', () => {
    render(<PortfolioOverview {...widgetProps(portfolioOverviewDefinition.defaultConfig, data)} />);
    expect(screen.getByText('₹3,75,750 Cr')).toBeInTheDocument();
    expect(screen.getByText('$45.0B')).toBeInTheDocument();
    expect(screen.getByText('MTD')).toBeInTheDocument();
  });

  it('switches primary currency and hides returns when configured', () => {
    render(<PortfolioOverview {...widgetProps(configuredConfig, data)} />);
    expect(screen.getAllByText('$45.0B')[0]).toHaveClass('text-lg');
    expect(screen.queryByText('MTD')).not.toBeInTheDocument();
  });

  it('pairs day P&L colour with a sign', () => {
    render(<PortfolioOverview {...widgetProps(portfolioOverviewDefinition.defaultConfig, data)} />);
    const sign = data.dayPnlInr >= 0 ? '+' : '−';
    expect(screen.getAllByText(new RegExp(`^\\${sign}₹`))[0]).toBeInTheDocument();
  });

  it('summarises for screen readers', () => {
    expect(summarizePortfolioOverview(data)).toMatch(/AUM \$45\.0B \(₹3,75,750 Cr\) at last close/);
  });
});
