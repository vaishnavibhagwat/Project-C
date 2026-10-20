import { z } from 'zod';
import type { Alert, AlertsData } from '@/data/schemas';

export const AlertsMonitorConfigSchema = z.object({
  minSeverity: z.enum(['info', 'warning', 'critical']),
  source: z.enum(['ALL', 'Risk', 'Concentration', 'Price', 'Settlement', 'Drawdown']),
  showDetail: z.boolean(),
});

export type AlertsMonitorConfig = z.infer<typeof AlertsMonitorConfigSchema>;
export type AlertsMonitorData = AlertsData;
export type { Alert };
