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
import type { RegisteredWidget } from './defineWidget';
import { WidgetRegistry } from './WidgetRegistry';

/** Built-in widgets, in marketplace order. */
const BUILT_IN_WIDGETS: readonly RegisteredWidget[] = [
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

/**
 * The app's widget registry. Only definitions live here (small); every component is a lazy
 * chunk that loads the first time a widget of that type is rendered.
 */
export const widgetRegistry = new WidgetRegistry<RegisteredWidget>();

for (const widget of BUILT_IN_WIDGETS) {
  try {
    widgetRegistry.registerWidget(widget);
  } catch (error) {
    // Fail loudly in development and tests. In production, skip the broken widget so the rest
    // of the workstation still loads; its instances show the "unknown widget" fallback.
    if (import.meta.env.DEV) throw error;
    console.error(error);
  }
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
