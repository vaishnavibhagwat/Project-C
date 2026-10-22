import type { GridItemLayout, PageId, PageSnapshot, WidgetInstance } from '@/types';
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

/** [widgetId, x, y, w, h, title] on the default grid (12 columns, 60 px rows, 8 px gaps). */
type Placement = [widgetId: string, x: number, y: number, w: number, h: number, title: string];

const PLACEMENTS: Record<PageId, Placement[]> = {
  workstation: [
    ['portfolio-overview', 0, 0, 12, 2, 'Portfolio Overview'],
    ['nav-performance', 0, 2, 6, 5, 'NAV vs Nifty 50'],
    ['asset-allocation', 6, 2, 3, 5, 'Asset Allocation'],
    ['var-gauge', 9, 2, 3, 5, 'Value at Risk'],
    ['holdings-table', 0, 7, 8, 6, 'Holdings'],
    ['alerts-monitor', 8, 7, 4, 6, 'Alerts'],
    ['sector-heatmap', 0, 13, 6, 5, 'Sector Returns Heat Map'],
    ['holdings-treemap', 6, 13, 6, 5, 'Holdings Treemap'],
    ['drawdown', 0, 18, 6, 4, 'Drawdown'],
    ['research-feed', 6, 18, 6, 4, 'Research Feed'],
  ],
  risk: [
    ['risk-metrics', 0, 0, 12, 2, 'Risk-Adjusted Metrics'],
    ['var-gauge', 0, 2, 4, 6, 'Value at Risk'],
    ['drawdown', 4, 2, 8, 6, 'Drawdown'],
    ['sector-heatmap', 0, 8, 8, 5, 'Sector Returns Heat Map'],
    ['alerts-monitor', 8, 8, 4, 5, 'Limit Alerts'],
  ],
  holdings: [
    ['holdings-table', 0, 0, 12, 6, 'Holdings'],
    ['holdings-treemap', 0, 6, 7, 6, 'Holdings Treemap'],
    ['asset-allocation', 7, 6, 5, 6, 'Allocation'],
    ['trade-blotter', 0, 12, 12, 5, 'Trade Blotter'],
  ],
  performance: [
    ['portfolio-overview', 0, 0, 12, 2, 'Portfolio Overview'],
    ['nav-performance', 0, 2, 8, 6, 'NAV vs Nifty 50'],
    ['risk-metrics', 8, 2, 4, 6, 'Risk-Adjusted Metrics'],
    ['sector-attribution', 0, 8, 12, 6, 'Sector Attribution'],
    ['drawdown', 0, 14, 12, 4, 'Drawdown'],
  ],
  research: [
    ['research-feed', 0, 0, 7, 7, 'Research Feed'],
    ['alerts-monitor', 7, 0, 5, 7, 'Alerts'],
    ['trade-blotter', 0, 7, 12, 5, 'Trade Blotter'],
  ],
};

/** Factory default snapshot for a page. Instance ids are stable so defaults are idempotent. */
export function defaultSnapshot(page: PageId): PageSnapshot {
  const placements = PLACEMENTS[page];
  const instances: WidgetInstance[] = placements.map(([widgetId, x, y, w, h, title]) => ({
    instanceId: `${page}-${widgetId}`,
    widgetId,
    config: {},
    position: { x, y, w, h },
    title,
  }));
  const lg: GridItemLayout[] = instances.map(({ instanceId, position }) => ({
    i: instanceId,
    ...position,
  }));
  return { page, layouts: { lg }, instances, grid: { ...DEFAULT_GRID_CONFIG } };
}
