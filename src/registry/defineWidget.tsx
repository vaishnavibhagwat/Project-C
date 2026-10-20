import { memo, useMemo, type ComponentType } from 'react';
import type { ZodType } from 'zod';
import type { WidgetConfig, WidgetDefinition } from '@/types';

/** Skeleton shapes. Each widget picks the one that matches its layout. */
export type SkeletonVariant =
  | 'line-chart'
  | 'area-chart'
  | 'donut'
  | 'bars'
  | 'table'
  | 'feed'
  | 'gauge'
  | 'tiles'
  | 'heatmap'
  | 'treemap';

export interface ErasedWidgetProps {
  instanceId: string;
  config: WidgetConfig;
  data: unknown;
  width: number;
  height: number;
}

/**
 * Registry entry: the public WidgetDefinition fields plus type-erased helpers the grid uses.
 * Type erasure happens through runtime checks (zod config parsing and a data type guard),
 * so no `any` or unchecked casts are needed to store heterogeneous widgets in one list.
 */
/** Contract fields minus the typed component (rendered through `Render` instead). */
export type WidgetMeta = Omit<WidgetDefinition<WidgetConfig, unknown>, 'component'>;

export interface WidgetEntry {
  definition: WidgetMeta;
  skeleton: SkeletonVariant;
  /** Merge stored settings over defaults; invalid values fall back to defaults. */
  resolveConfig: (stored: WidgetConfig) => WidgetConfig;
  isEmpty: (data: unknown) => boolean;
  summarize: (data: unknown, config: WidgetConfig) => string;
  /** Loads the lazy chunk ahead of render (used on hover in the marketplace). */
  preload: () => void;
  Render: ComponentType<ErasedWidgetProps>;
}

export interface RegisterOptions<TConfig extends WidgetConfig, TData> {
  configParser: ZodType<TConfig>;
  isData: (value: unknown) => value is TData;
  isEmpty?: (data: TData) => boolean;
  summarize: (data: TData, config: TConfig) => string;
  skeleton: SkeletonVariant;
  preload: () => Promise<unknown>;
}

export function resolveWith<TConfig extends WidgetConfig>(
  parser: ZodType<TConfig>,
  defaults: TConfig,
  stored: WidgetConfig,
): TConfig {
  const whole = parser.safeParse({ ...defaults, ...stored });
  if (whole.success) return whole.data;
  // Keep each stored value that is individually valid; drop the rest.
  let acc: WidgetConfig = { ...defaults };
  for (const [key, value] of Object.entries(stored)) {
    const attempt = parser.safeParse({ ...acc, [key]: value });
    if (attempt.success) acc = attempt.data;
  }
  const final = parser.safeParse(acc);
  return final.success ? final.data : defaults;
}

function InvalidData() {
  return <p className="p-3 text-xs text-neg">Received data in an unexpected shape.</p>;
}

export function registerWidget<TConfig extends WidgetConfig, TData>(
  definition: WidgetDefinition<TConfig, TData>,
  options: RegisterOptions<TConfig, TData>,
): WidgetEntry {
  const { component: Component, defaultConfig, ...rest } = definition;
  const { configParser, isData, summarize } = options;
  const isEmpty = options.isEmpty ?? (() => false);
  const resolve = (stored: WidgetConfig) => resolveWith(configParser, defaultConfig, stored);

  function Render({ config, data, ...props }: ErasedWidgetProps) {
    const parsed = useMemo(() => resolve(config), [config]);
    if (!isData(data)) return <InvalidData />;
    return <Component {...props} config={parsed} data={data} />;
  }
  Render.displayName = `Widget(${definition.id})`;

  return {
    definition: { ...rest, defaultConfig },
    skeleton: options.skeleton,
    resolveConfig: resolve,
    isEmpty: (data) => isData(data) && isEmpty(data),
    summarize: (data, config) => (isData(data) ? summarize(data, resolve(config)) : ''),
    preload: () => {
      void options.preload();
    },
    Render: memo(Render),
  };
}
