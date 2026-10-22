import { z } from 'zod';
import type { AlertsData } from '@/data/schemas';
import type { Alert, AlertType } from '@/types';

export const ALERT_TYPE_FILTERS = [
  'all',
  'price_breach',
  'risk_limit',
  'news_event',
  'rebalance_signal',
] as const;

export const AlertsMonitorConfigSchema = z.object({
  minSeverity: z.enum(['info', 'warning', 'critical']),
  type: z.enum(ALERT_TYPE_FILTERS),
  showAcknowledged: z.boolean(),
});

export type AlertsMonitorConfig = z.infer<typeof AlertsMonitorConfigSchema>;
export type AlertsMonitorData = AlertsData;
export type { Alert, AlertType };
