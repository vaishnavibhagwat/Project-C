import { lazy } from 'react';
import { IconShield } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { registerWidget } from '@/registry/defineWidget';
import { env } from '@/utils/env';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { formatInrCompact, formatPct } from '@/utils/format';
import { selectVar, STATUS_LABEL } from './model';
import { VarGaugeConfigSchema, type VarGaugeConfig, type VarGaugeData } from './types';

export const varGaugeDefinition: WidgetDefinition<VarGaugeConfig, VarGaugeData> = {
  id: 'var-gauge',
  name: 'Value at Risk',
  description:
    '1-day VaR from historical simulation (252-day lookback) and the parametric normal method, against a configurable limit.',
  category: WidgetCategory.GAUGE,
  defaultSize: { w: 3, h: 10 },
  minSize: { w: 3, h: 7 },
  configSchema: {
    type: 'object',
    properties: {
      confidence: {
        title: 'Confidence level',
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
  dataSource: { endpoint: 'risk/var', refreshIntervalMs: env.VITE_DATA_REFRESH_INTERVAL },
};

export function summarizeVar(data: VarGaugeData, config: VarGaugeConfig): string {
  const r = selectVar(data, config);
  return (
    `${config.confidence}% 1-day ${config.method} VaR is ${formatPct(r.value, 2, false)} of AUM, ` +
    `about ${formatInrCompact(r.value * data.portfolioValueInr)}. ${STATUS_LABEL[r.status]}: ` +
    `${Math.round(r.utilisation * 100)}% of the ${config.limitPct}% limit.`
  );
}

export const varGaugeWidget = registerWidget(varGaugeDefinition, {
  configParser: VarGaugeConfigSchema,
  isData: isEndpointData('risk/var'),
  isEmpty: (d) => d.lookbackDays === 0,
  summarize: summarizeVar,
  skeleton: 'gauge',
  preload: () => import('./index'),
});
