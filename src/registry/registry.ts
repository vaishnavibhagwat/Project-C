import { WidgetCategory } from '@/types';
import { alertsMonitorWidget } from '@/widgets/alerts-monitor/config';
import { assetAllocationWidget } from '@/widgets/asset-allocation/config';
import { drawdownWidget } from '@/widgets/drawdown/config';
import { holdingsTableWidget } from '@/widgets/holdings-table/config';
import { holdingsTreemapWidget } from '@/widgets/holdings-treemap/config';
import { navPerformanceWidget } from '@/widgets/nav-performance/config';
import { portfolioOverviewWidget } from '@/widgets/portfolio-overview/config';
import { researchFeedWidget } from '@/widgets/research-feed/config';
import { riskMetricsWidget } from '@/widgets/risk-metrics/config';
import { sectorAttributionWidget } from '@/widgets/sector-attribution/config';
import { sectorHeatmapWidget } from '@/widgets/sector-heatmap/config';
import { tradeBlotterWidget } from '@/widgets/trade-blotter/config';
import { varGaugeWidget } from '@/widgets/var-gauge/config';
import type { WidgetEntry } from './defineWidget';

/**
 * The widget registry. Only definitions live here (small); every component is a lazy chunk
 * that loads the first time a widget of that type is rendered.
 */
export const WIDGETS: readonly WidgetEntry[] = [
  portfolioOverviewWidget,
  navPerformanceWidget,
  assetAllocationWidget,
  drawdownWidget,
  sectorAttributionWidget,
  holdingsTableWidget,
  tradeBlotterWidget,
  researchFeedWidget,
  alertsMonitorWidget,
  varGaugeWidget,
  riskMetricsWidget,
  sectorHeatmapWidget,
  holdingsTreemapWidget,
];

const BY_ID = new Map(WIDGETS.map((w) => [w.definition.id, w]));

export function getWidget(type: string): WidgetEntry | undefined {
  return BY_ID.get(type);
}

export const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  [WidgetCategory.CHART]: 'Charts',
  [WidgetCategory.TABLE]: 'Tables',
  [WidgetCategory.FEED]: 'Feeds',
  [WidgetCategory.GAUGE]: 'Gauges',
  [WidgetCategory.ANALYSIS]: 'Analysis',
};

export const CATEGORIES: readonly WidgetCategory[] = [
  WidgetCategory.CHART,
  WidgetCategory.TABLE,
  WidgetCategory.FEED,
  WidgetCategory.GAUGE,
  WidgetCategory.ANALYSIS,
];
