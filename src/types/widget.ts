import type { ComponentType, LazyExoticComponent } from 'react';
import type { JSONSchema7 } from 'json-schema';
import type { EndpointId } from './data';

/** Widget categories used by the registry and the marketplace. */
export enum WidgetCategory {
  CHART = 'CHART',
  TABLE = 'TABLE',
  FEED = 'FEED',
  GAUGE = 'GAUGE',
  ANALYSIS = 'ANALYSIS',
}

export interface GridSize {
  w: number;
  h: number;
}

/** Placement of a widget on the desktop (lg) grid, in grid units. */
export interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Simulated network latency class of an endpoint (scales VITE_API_LATENCY_MS). */
export type LatencyProfile = 'low' | 'normal' | 'high';

/** Describes where a widget gets its data and how often it refreshes. */
export interface DataSourceConfig {
  /** Mock API endpoint served from the shared dataset. */
  endpoint: EndpointId;
  /**
   * Channel the widget would subscribe to on a live WebSocket feed (VITE_WS_URL). Reserved: the
   * simulated feed is polled, so no socket is opened in mock mode.
   */
  wsChannel?: string;
  /** Poll interval in milliseconds. Data older than 2x this value is flagged as stale. */
  refreshInterval: number;
  /** Simulated latency class: low ≈ 0.4x, normal 1x, high ≈ 2.5x the configured latency. */
  latencyProfile: LatencyProfile;
}

/** Props every widget component receives from its frame. */
export interface WidgetComponentProps<TConfig, TData> {
  instanceId: string;
  config: TConfig;
  data: TData;
  /** True while a refresh is in flight (the widget is showing the previous data). */
  isLoading: boolean;
  /** Last refresh error while previous data is still shown, otherwise null. */
  error: Error | null;
  /** True when data is older than 2x the widget's refresh interval. */
  isStale: boolean;
  /** When the data was last refreshed, as an IST ISO timestamp; null before the first load. */
  lastUpdated: string | null;
  /** Persist a change to this widget's settings (e.g. an in-widget range toggle). */
  onConfigChange: (patch: Partial<TConfig>) => void;
  /** Size of the widget body in pixels, measured by the frame. */
  width: number;
  height: number;
}

export type WidgetComponentType<TConfig, TData> = ComponentType<
  WidgetComponentProps<TConfig, TData>
>;

/**
 * The widget contract. Field names are fixed by the assessment brief. The defaults describe a
 * type-erased definition (any widget's settings and data), as stored in the registry.
 */
export interface WidgetDefinition<TConfig = WidgetConfig, TData = unknown> {
  id: string;
  name: string;
  description: string;
  category: WidgetCategory;
  defaultSize: GridSize;
  minSize: GridSize;
  maxSize?: GridSize;
  configSchema: JSONSchema7;
  defaultConfig: TConfig;
  component: LazyExoticComponent<WidgetComponentType<TConfig, TData>>;
  icon: ComponentType;
  dataSource: DataSourceConfig;
}

/** Plain JSON values allowed in persisted widget configuration. */
export type ConfigValue = string | number | boolean;
export type WidgetConfig = Record<string, ConfigValue>;

/** A placed widget. Only settings and placement are persisted, never datasets. */
export interface WidgetInstance {
  instanceId: string;
  /** Registry id of the widget type (WidgetDefinition.id). */
  widgetId: string;
  config: WidgetConfig;
  /** Desktop (lg) placement; other breakpoints live in DashboardStore. */
  position: GridPosition;
  /** Optional user-chosen title; the widget's name is shown when absent. */
  title?: string;
}
