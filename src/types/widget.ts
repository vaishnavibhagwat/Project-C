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

/** Describes where a widget gets its data and how often it should refresh. */
export interface DataSourceConfig {
  /** Mock API endpoint served from the shared dataset. */
  endpoint: EndpointId;
  /** Poll interval. Data older than 2x this value is flagged as stale. */
  refreshIntervalMs: number;
}

/** Props every widget component receives from its frame. */
export interface WidgetComponentProps<TConfig, TData> {
  instanceId: string;
  config: TConfig;
  data: TData;
  /** Size of the widget body in pixels, measured by the frame. */
  width: number;
  height: number;
}

export type WidgetComponentType<TConfig, TData> = ComponentType<
  WidgetComponentProps<TConfig, TData>
>;

/** The widget contract. Field names are fixed by the assessment brief. */
export interface WidgetDefinition<TConfig, TData> {
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

/** Plain JSON object used for persisted widget configuration. */
export type ConfigValue = string | number | boolean;
export type WidgetConfig = Record<string, ConfigValue>;

/** A placed widget on a page. Only settings are persisted, never datasets. */
export interface WidgetInstance {
  id: string;
  type: string;
  title: string;
  config: WidgetConfig;
}
