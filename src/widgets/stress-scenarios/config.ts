import { lazy } from 'react';
import { IconAlert } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { env } from '@/utils/env';
import { stressSummary } from './model';
import {
  StressScenariosConfigSchema,
  type StressScenariosConfig,
  type StressScenariosData,
} from './types';

export const stressScenariosDefinition: WidgetDefinition<
  StressScenariosConfig,
  StressScenariosData
> = {
  id: 'stress-scenarios',
  name: 'Stress Scenarios',
  description:
    'Estimated portfolio impact of Nifty 50 −10%, rates +100 bps, INR −5% and a 2020 COVID replay, with the largest contributors.',
  category: WidgetCategory.TABLE,
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 4, h: 3 },
  maxSize: { w: 12, h: 8 },
  configSchema: {
    type: 'object',
    properties: {
      currency: {
        title: 'Currency',
        oneOf: [
          { const: 'INR', title: 'INR (₹)' },
          { const: 'USD', title: 'USD ($)' },
        ],
      },
      showDetail: { type: 'boolean', title: 'Show asset classes and largest contributors' },
    },
  },
  defaultConfig: { currency: 'INR', showDetail: true },
  component: lazy(() => import('./index')),
  icon: IconAlert,
  dataSource: {
    endpoint: 'risk/stress',
    refreshInterval: env.VITE_DATA_REFRESH_INTERVAL,
    latencyProfile: 'high',
  },
};

export const stressScenariosWidget = defineWidget(stressScenariosDefinition, {
  configParser: StressScenariosConfigSchema,
  isData: isEndpointData('risk/stress'),
  isEmpty: (d) => d.scenarios.length === 0,
  summarize: (data) => stressSummary(data),
  skeleton: 'table',
  preload: () => import('./index'),
});
