import type { GridItemLayout, PageId, PageSnapshot, WidgetConfig, WidgetInstance } from '@/types';
import { DEFAULT_GRID_CONFIG } from '@/utils/gridLayout';

export interface PageMeta {
  id: PageId;
  title: string;
  short: string;
  description: string;
}

const PAGE_LIST: PageMeta[] = [
  {
    id: 'workstation',
    title: 'Portfolio Workstation',
    short: 'Workstation',
    description: 'Firm-wide view: NAV, allocation, risk, holdings and research in one grid.',
  },
  {
    id: 'risk',
    title: 'Risk Analytics',
    short: 'Risk',
    description:
      'VaR, risk contribution, stress scenarios, drawdown, volatility, correlations and exposure, with page-wide confidence and horizon.',
  },
  {
    id: 'holdings',
    title: 'Holdings Explorer',
    short: 'Holdings',
    description:
      'Every position with filters, selection and a detail drawer; concentration and today’s executions.',
  },
  {
    id: 'performance',
    title: 'Performance & Attribution',
    short: 'Performance',
    description:
      'Returns against benchmarks, NAV history, Brinson attribution (asset class → sector → holding), drawdown and risk-adjusted metrics.',
  },
  {
    id: 'research',
    title: 'Research & Alerts',
    short: 'Research',
    description:
      'Market ticker, sample news and research, and alerts with rules, read state and acknowledgement.',
  },
];

export const PAGES: readonly PageMeta[] = PAGE_LIST;

const FALLBACK_PAGE: PageMeta = {
  id: 'workstation',
  title: 'Portfolio Workstation',
  short: 'Workstation',
  description: '',
};

export function getPageMeta(id: PageId): PageMeta {
  return PAGE_LIST.find((p) => p.id === id) ?? FALLBACK_PAGE;
}

/**
 * [widgetId, x, y, w, h, title, settings?] on the default grid (12 columns, 60 px rows, 8 px
 * gaps). Settings override the widget's defaults for that placement.
 */
type Placement = [
  widgetId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  config?: WidgetConfig,
];

const PLACEMENTS: Record<PageId, Placement[]> = {
  // The Portfolio Summary Strip sits above this grid, so the overview widget is not repeated.
  workstation: [
    ['nav-performance', 0, 0, 6, 5, 'NAV vs Nifty 50'],
    ['asset-allocation', 6, 0, 3, 5, 'Asset Allocation'],
    ['var-gauge', 9, 0, 3, 5, 'Value at Risk'],
    ['holdings-table', 0, 5, 8, 6, 'Holdings'],
    ['alerts-monitor', 8, 5, 4, 6, 'Alerts'],
    ['sector-heatmap', 0, 11, 6, 5, 'Sector Returns Heat Map'],
    ['holdings-treemap', 6, 11, 6, 5, 'Holdings Treemap'],
    ['drawdown', 0, 16, 6, 4, 'Drawdown'],
    ['research-feed', 6, 16, 6, 4, 'Research Feed'],
  ],
  risk: [
    ['var-gauge', 0, 0, 3, 5, 'Value at Risk'],
    ['risk-contribution', 3, 0, 5, 5, 'Risk Contribution by Holding'],
    ['stress-scenarios', 8, 0, 4, 5, 'Stress Scenarios'],
    ['drawdown', 0, 5, 6, 4, 'Drawdown'],
    ['volatility-history', 6, 5, 6, 4, 'Volatility History'],
    ['correlation-matrix', 0, 9, 6, 6, 'Correlation Matrix'],
    ['exposure-breakdown', 6, 9, 6, 6, 'Exposure Breakdown'],
  ],
  holdings: [
    ['holdings-table', 0, 0, 12, 9, 'Holdings'],
    ['holdings-treemap', 0, 9, 7, 6, 'Holdings Treemap'],
    ['asset-allocation', 7, 9, 5, 6, 'Allocation'],
    ['trade-blotter', 0, 15, 12, 5, 'Trade Blotter'],
  ],
  performance: [
    ['portfolio-overview', 0, 0, 12, 2, 'Portfolio Overview'],
    ['performance-line-chart', 0, 2, 8, 5, 'Performance vs Benchmarks'],
    ['risk-metrics', 8, 2, 4, 5, 'Risk-Adjusted Metrics', { layout: 'table' }],
    ['nav-performance', 0, 7, 6, 5, 'NAV History'],
    ['drawdown', 6, 7, 6, 5, 'Drawdown & Recovery'],
    ['attribution-bar-chart', 0, 12, 12, 6, 'Brinson Attribution', { grouping: 'asset-class' }],
  ],
  research: [
    ['market-ticker', 0, 0, 12, 1, 'Market Ticker'],
    ['news-feed', 0, 1, 7, 8, 'News Feed'],
    ['alert-panel', 7, 1, 5, 8, 'Alerts'],
    ['research-feed', 0, 9, 12, 5, 'Research Notes'],
  ],
};

/** Factory default snapshot for a page. Instance ids are stable so defaults are idempotent. */
export function defaultSnapshot(page: PageId): PageSnapshot {
  const placements = PLACEMENTS[page];
  const instances: WidgetInstance[] = placements.map(([widgetId, x, y, w, h, title, config]) => ({
    instanceId: `${page}-${widgetId}`,
    widgetId,
    config: config ?? {},
    position: { x, y, w, h },
    title,
  }));
  const desktop: GridItemLayout[] = instances.map(({ instanceId, position }) => ({
    i: instanceId,
    ...position,
  }));
  return { page, layouts: { desktop }, instances, grid: { ...DEFAULT_GRID_CONFIG } };
}
