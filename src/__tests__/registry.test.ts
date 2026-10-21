import { describe, expect, it } from 'vitest';
import { ENDPOINT_IDS } from '@/data/endpoints';
import { defaultSnapshot, PAGES } from '@/registry/pages';
import { getWidget, WIDGETS } from '@/registry/registry';
import { resolveWith } from '@/registry/defineWidget';
import { WidgetCategory } from '@/types';
import { validateConfig } from '@/utils/jsonSchema';
import { NavPerformanceConfigSchema } from '@/widgets/nav-performance/types';

const CONTRACT_FIELDS = [
  'id',
  'name',
  'description',
  'category',
  'defaultSize',
  'minSize',
  'configSchema',
  'defaultConfig',
  'icon',
  'dataSource',
];

describe('widget registry', () => {
  it('has unique ids and at least one widget per category', () => {
    const ids = WIDGETS.map((w) => w.definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of Object.values(WidgetCategory)) {
      expect(WIDGETS.some((w) => w.definition.category === c)).toBe(true);
    }
  });

  it.each(WIDGETS.map((w) => [w.definition.id, w] as const))(
    '%s honours the WidgetDefinition contract',
    (_, w) => {
      const d = w.definition;
      for (const field of CONTRACT_FIELDS) expect(d).toHaveProperty(field);
      expect(d.minSize.w).toBeLessThanOrEqual(d.defaultSize.w);
      expect(d.minSize.h).toBeLessThanOrEqual(d.defaultSize.h);
      if (d.maxSize) expect(d.maxSize.w).toBeGreaterThanOrEqual(d.defaultSize.w);
      expect(ENDPOINT_IDS).toContain(d.dataSource.endpoint);
      expect(d.dataSource.refreshIntervalMs).toBeGreaterThanOrEqual(1000);
      // Defaults satisfy both the JSON Schema (form) and the zod parser (runtime).
      expect(validateConfig(d.configSchema, d.defaultConfig)).toEqual({});
      expect(w.resolveConfig({})).toEqual(d.defaultConfig);
    },
  );

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
      for (const i of snap.instances) expect(getWidget(i.type)).toBeDefined();
      expect(snap.layouts.lg).toHaveLength(snap.instances.length);
    }
  });
});
