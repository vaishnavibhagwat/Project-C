import { lazy } from 'react';
import { IconShield } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { formatInrCompact, formatPct } from '@/utils/format';
import { rangeFor, selectVar, statusLabel } from './model';
import { VarGaugeConfigSchema, type VarGaugeConfig, type VarGaugeData } from './types';

/** Brief: refresh every 60 s (the VaR inputs are end-of-day returns). */
export const VAR_GAUGE_REFRESH_MS = 60_000;

export const varGaugeDefinition: WidgetDefinition<VarGaugeConfig, VarGaugeData> = {
  id: 'var-gauge',
  name: 'Value at Risk',
  description:
    'Speedometer of 1-day portfolio VaR (99% by default; historical or parametric, 252-day lookback) against a configurable limit, with the 30-day range.',
  category: WidgetCategory.GAUGE,
  defaultSize: { w: 2, h: 2 },
  minSize: { w: 2, h: 2 },
  maxSize: { w: 6, h: 8 },
  configSchema: {
    type: 'object',
    properties: {
      confidence: {
        title: 'Confidence level',
        description: '1-day horizon. 99% is the default, as SEBI uses for risk reporting.',
        oneOf: [
          { const: '95', title: '95%' },
          { const: '99', title: '99%' },
        ],
      },
      method: {
        title: 'Gauge method',
        oneOf: [
          { const: 'historical', title: 'Historical simulation' },
          { const: 'parametric', title: 'Parametric (normal)' },
        ],
      },
      limitPct: {
        type: 'number',
        title: 'VaR limit (% of AUM)',
        minimum: 0.5,
        maximum: 5,
        multipleOf: 0.1,
      },
      currency: {
        title: 'Currency',
        oneOf: [
          { const: 'INR', title: 'INR (₹)' },
          { const: 'USD', title: 'USD ($)' },
        ],
      },
      showHistogram: { type: 'boolean', title: 'Show return distribution' },
    },
  },
  defaultConfig: {
    confidence: '99',
    method: 'historical',
    limitPct: 2,
    currency: 'INR',
    showHistogram: true,
  },
  component: lazy(() => import('./index')),
  icon: IconShield,
  dataSource: {
    endpoint: 'risk/var',
    refreshInterval: VAR_GAUGE_REFRESH_MS,
    latencyProfile: 'high',
  },
};

export function summarizeVar(data: VarGaugeData, config: VarGaugeConfig): string {
  const r = selectVar(data, config);
  const range = rangeFor(data, config);
  return (
    `${config.confidence}% 1-day ${config.method} VaR is ${formatPct(r.value, 2, false)} of AUM, ` +
    `about ${formatInrCompact(r.value * data.portfolioValueInr)}. ${statusLabel(r)}: ` +
    `${Math.round(r.utilisation * 100)}% of the ${config.limitPct}% limit.` +
    (range
      ? ` ${range.days}-day range ${formatPct(range.min, 2, false)} to ${formatPct(range.max, 2, false)}.`
      : '')
  );
}

export const varGaugeWidget = defineWidget(varGaugeDefinition, {
  configParser: VarGaugeConfigSchema,
  isData: isEndpointData('risk/var'),
  isEmpty: (d) => d.lookbackDays === 0,
  summarize: summarizeVar,
  skeleton: 'gauge',
  preload: () => import('./index'),
});
