import { lazy, memo, useCallback, useMemo } from 'react';
import type { ZodType } from 'zod';
import type {
  WidgetComponentProps,
  WidgetComponentType,
  WidgetConfig,
  WidgetDefinition,
} from '@/types';

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

/**
 * What the app registers: a type-erased WidgetDefinition plus the helpers the grid needs.
 * `component` checks config (zod) and data (type guard) at runtime before rendering the
 * widget's own typed component, so widgets with different config and data types can share
 * one registry without `any` or unchecked casts.
 */
export interface RegisteredWidget extends WidgetDefinition {
  skeleton: SkeletonVariant;
  /** Merge stored settings over defaults; invalid values fall back to defaults. */
  resolveConfig: (stored: WidgetConfig) => WidgetConfig;
  isEmpty: (data: unknown) => boolean;
  summarize: (data: unknown, config: WidgetConfig) => string;
  /** Loads the lazy chunk ahead of render (used on hover in the marketplace). */
  preload: () => void;
}

export interface DefineWidgetOptions<TConfig extends WidgetConfig, TData> {
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

/**
 * Turn a widget's typed definition into the erased RegisteredWidget that goes into the
 * registry. Called once in each widget's config.ts; registration itself happens in
 * registry.ts so every widget is validated in one place.
 */
export function defineWidget<TConfig extends WidgetConfig, TData>(
  definition: WidgetDefinition<TConfig, TData>,
  options: DefineWidgetOptions<TConfig, TData>,
): RegisteredWidget {
  const { component: Component, defaultConfig, ...rest } = definition;
  const { configParser, isData, summarize } = options;
  const isEmpty = options.isEmpty ?? (() => false);
  const resolve = (stored: WidgetConfig) => resolveWith(configParser, defaultConfig, stored);

  function Erased({
    config,
    data,
    onConfigChange,
    ...props
  }: WidgetComponentProps<WidgetConfig, unknown>) {
    const parsed = useMemo(() => resolve(config), [config]);
    const onChange = useCallback(
      (patch: Partial<TConfig>) => onConfigChange(patch),
      [onConfigChange],
    );
    if (!isData(data)) return <InvalidData />;
    return <Component {...props} config={parsed} data={data} onConfigChange={onChange} />;
  }
  Erased.displayName = `Widget(${definition.id})`;
  const ErasedWidget = memo(Erased);

  return {
    ...rest,
    defaultConfig,
    // Still a lazy component, as the contract requires: it resolves once the widget's chunk
    // has loaded.
    component: lazy<WidgetComponentType<WidgetConfig, unknown>>(async () => {
      await options.preload();
      return { default: ErasedWidget };
    }),
    skeleton: options.skeleton,
    resolveConfig: resolve,
    isEmpty: (data) => isData(data) && isEmpty(data),
    summarize: (data, config) => (isData(data) ? summarize(data, resolve(config)) : ''),
    preload: () => {
      void options.preload();
    },
  };
}
