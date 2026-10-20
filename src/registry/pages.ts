import type { GridItemLayout, PageId, PageSnapshot, WidgetInstance } from '@/types';

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
    description: 'Value-at-Risk, drawdowns, risk-adjusted returns and limit monitoring.',
  },
  {
    id: 'holdings',
    title: 'Holdings Explorer',
    short: 'Holdings',
    description: 'Position-level detail, concentration and today’s executions.',
  },
  {
    id: 'performance',
    title: 'Performance & Attribution',
    short: 'Performance',
    description: 'Returns against the Nifty 50 and sector attribution of active return.',
  },
  {
    id: 'research',
    title: 'Research & Alerts',
    short: 'Research',
    description: 'Sample research notes, rule-based alerts and the trade blotter.',
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

type Placement = [type: string, x: number, y: number, w: number, h: number, title: string];

const PLACEMENTS: Record<PageId, Placement[]> = {
  workstation: [
    ['portfolio-overview', 0, 0, 12, 3, 'Portfolio Overview'],
    ['nav-performance', 0, 3, 6, 10, 'NAV vs Nifty 50'],
    ['asset-allocation', 6, 3, 3, 10, 'Asset Allocation'],
    ['var-gauge', 9, 3, 3, 10, 'Value at Risk'],
    ['holdings-table', 0, 13, 8, 11, 'Holdings'],
    ['alerts-monitor', 8, 13, 4, 11, 'Alerts'],
    ['sector-heatmap', 0, 24, 6, 10, 'Sector Returns Heat Map'],
    ['holdings-treemap', 6, 24, 6, 10, 'Holdings Treemap'],
    ['drawdown', 0, 34, 6, 8, 'Drawdown'],
    ['research-feed', 6, 34, 6, 8, 'Research Feed'],
  ],
  risk: [
    ['risk-metrics', 0, 0, 12, 4, 'Risk-Adjusted Metrics'],
    ['var-gauge', 0, 4, 4, 11, 'Value at Risk'],
    ['drawdown', 4, 4, 8, 11, 'Drawdown'],
    ['sector-heatmap', 0, 15, 8, 10, 'Sector Returns Heat Map'],
    ['alerts-monitor', 8, 15, 4, 10, 'Limit Alerts'],
  ],
  holdings: [
    ['holdings-table', 0, 0, 12, 12, 'Holdings'],
    ['holdings-treemap', 0, 12, 7, 11, 'Holdings Treemap'],
    ['asset-allocation', 7, 12, 5, 11, 'Allocation'],
    ['trade-blotter', 0, 23, 12, 10, 'Trade Blotter'],
  ],
  performance: [
    ['portfolio-overview', 0, 0, 12, 3, 'Portfolio Overview'],
    ['nav-performance', 0, 3, 8, 11, 'NAV vs Nifty 50'],
    ['risk-metrics', 8, 3, 4, 11, 'Risk-Adjusted Metrics'],
    ['sector-attribution', 0, 14, 12, 11, 'Sector Attribution'],
    ['drawdown', 0, 25, 12, 8, 'Drawdown'],
  ],
  research: [
    ['research-feed', 0, 0, 7, 14, 'Research Feed'],
    ['alerts-monitor', 7, 0, 5, 14, 'Alerts'],
    ['trade-blotter', 0, 14, 12, 10, 'Trade Blotter'],
  ],
};

/** Factory default snapshot for a page. Instance ids are stable so defaults are idempotent. */
export function defaultSnapshot(page: PageId): PageSnapshot {
  const placements = PLACEMENTS[page];
  const instances: WidgetInstance[] = placements.map(([type, , , , , title]) => ({
    id: `${page}-${type}`,
    type,
    title,
    config: {},
  }));
  const lg: GridItemLayout[] = placements.map(([type, x, y, w, h]) => ({
    i: `${page}-${type}`,
    x,
    y,
    w,
    h,
  }));
  return { page, layouts: { lg }, instances };
}
