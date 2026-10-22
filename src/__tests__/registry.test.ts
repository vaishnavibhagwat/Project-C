import { describe, expect, it } from 'vitest';
import { resolveWith } from '@/registry/defineWidget';
import { isLazyComponent, validateWidgetDefinition } from '@/registry/definitionValidator';
import { defaultSnapshot, PAGES } from '@/registry/pages';
import { widgetRegistry } from '@/registry/registry';
import { WidgetCategory } from '@/types';
import { NavPerformanceConfigSchema } from '@/widgets/nav-performance/types';

describe('built-in widget registry', () => {
  const widgets = widgetRegistry.getAllWidgets();

  it('registers all 13 widgets with unique ids and every category represented', () => {
    expect(widgetRegistry.size).toBe(13);
    expect(new Set(widgets.map((w) => w.id)).size).toBe(widgets.length);
    for (const c of Object.values(WidgetCategory)) {
      expect(widgetRegistry.getWidgetsByCategory(c).length).toBeGreaterThan(0);
    }
  });

  it.each(widgets.map((w) => [w.id, w] as const))('%s honours the contract', (_, w) => {
    expect(validateWidgetDefinition(w)).toEqual({ valid: true, errors: [] });
    expect(isLazyComponent(w.component)).toBe(true);
    // Defaults satisfy both the JSON Schema (form) and the zod parser (runtime).
    expect(widgetRegistry.validateConfig(w.id, w.defaultConfig).errors).toEqual([]);
    expect(w.resolveConfig({})).toEqual(w.defaultConfig);
  });

  it('falls back to defaults for invalid stored settings, keeping valid ones', () => {
    const defaults = { range: '1Y', showBenchmark: true, mode: 'rebased' } as const;
    const resolved = resolveWith(NavPerformanceConfigSchema, defaults, {
      range: '5Y',
      mode: 'bogus',
      extra: 1,
    });
    expect(resolved).toEqual({ range: '5Y', showBenchmark: true, mode: 'rebased' });
  });

  it('places only registered widgets on default pages', () => {
    for (const page of PAGES) {
      const snap = defaultSnapshot(page.id);
      for (const i of snap.instances) expect(widgetRegistry.hasWidget(i.widgetId)).toBe(true);
      expect(snap.layouts.lg).toHaveLength(snap.instances.length);
    }
  });
});
