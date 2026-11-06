import { validate as isUuid, version as uuidVersion } from 'uuid';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  fromJSON,
  LAYOUT_FORMAT_VERSION,
  LayoutSerializer,
  parseJsonSafely,
  serializedBytes,
  toDocument,
  toJSON,
  toSnapshot,
  type DashboardState,
  type LayoutDocument,
} from '@/layout/LayoutSerializer';
import { defaultSnapshot } from '@/registry/pages';
import { widgetRegistry } from '@/registry/registry';
import { applySnapshot } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { PAGE_IDS } from '@/store/schemas';
import { MAX_LAYOUT_BYTES } from '@/store/share';
import { useWidgetStore } from '@/store/widgetStore';
import { BUILT_IN_THEMES, defaultTheme } from '@/theme/themes';
import type { GridItemLayout, PageId, PageSnapshot, WidgetInstance } from '@/types';
import { deriveLayout, TABLET_COLS, MOBILE_COLS } from '@/utils/gridLayout';

const NOW = Date.parse('2026-11-06T13:30:00Z'); // 19:00 IST
const theme = defaultTheme();
const initial = { dashboard: useDashboardStore.getState(), widgets: useWidgetStore.getState() };

beforeEach(() => {
  useDashboardStore.setState(initial.dashboard, true);
  useWidgetStore.setState(initial.widgets, true);
});

/** A page snapshot with layouts on all three breakpoints, as the grid stores them. */
function fullSnapshot(page: PageId): PageSnapshot {
  const base = defaultSnapshot(page);
  const desktop = base.layouts.desktop ?? [];
  return {
    ...base,
    layouts: {
      desktop,
      tablet: deriveLayout(desktop, TABLET_COLS, 'vertical'),
      mobile: deriveLayout(desktop, MOBILE_COLS, 'vertical'),
    },
  };
}

const stateFor = (snapshot: PageSnapshot, meta: Partial<DashboardState['meta']> = {}) => ({
  snapshot,
  theme,
  meta: {
    id: '1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b',
    name: 'Risk desk',
    description: 'Morning risk review',
    createdBy: 'Portfolio Manager',
    ...meta,
  },
});

const xywh = (items: readonly GridItemLayout[] | undefined) =>
  (items ?? []).map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));

function parsed(json: string): LayoutDocument {
  const result = fromJSON(json, NOW);
  if (!result.ok) throw new Error(`${result.error} ${result.issues.join('; ')}`);
  return result.layout;
}

/** 15 real widgets, each with its default settings, a title and all three positions. */
function fifteenWidgetSnapshot(): PageSnapshot {
  const widgets = widgetRegistry.getAllWidgets().slice(0, 15);
  expect(widgets).toHaveLength(15);
  const instances: WidgetInstance[] = widgets.map((w, n) => ({
    instanceId: `workstation-${w.id}-${n}`,
    widgetId: w.id,
    config: { ...w.defaultConfig },
    title: `${w.name} (desk copy)`,
    position: { x: (n % 3) * 4, y: Math.floor(n / 3) * 5, w: 4, h: 5 },
  }));
  const desktop = instances.map((i) => ({ i: i.instanceId, ...i.position }));
  return {
    page: 'workstation',
    instances,
    grid: { cols: 12, rowHeight: 60, gap: 8, compaction: 'vertical' },
    layouts: {
      desktop,
      tablet: deriveLayout(desktop, TABLET_COLS, 'vertical'),
      mobile: deriveLayout(desktop, MOBILE_COLS, 'vertical'),
    },
  };
}

describe('LayoutSerializer.toJSON', () => {
  it('writes every schema field, in a fixed order', () => {
    const doc = toDocument(stateFor(fullSnapshot('risk')), NOW);
    expect(Object.keys(doc)).toEqual([
      'version',
      'id',
      'name',
      'description',
      'createdAt',
      'updatedAt',
      'createdBy',
      'gridConfig',
      'widgets',
      'theme',
      'breakpoints',
    ]);
    expect(doc.version).toBe(LAYOUT_FORMAT_VERSION);
    expect(doc.createdAt).toBe('2026-11-06T19:00:00+05:30');
    expect(doc.breakpoints).toEqual({
      desktop: { minWidth: 1280, cols: 12 },
      tablet: { minWidth: 768, cols: 6 },
      mobile: { minWidth: 0, cols: 1 },
    });
    expect(Object.keys(doc.widgets[0] ?? {})).toEqual([
      'instanceId',
      'widgetId',
      'title',
      'position',
      'config',
    ]);
    expect(Object.keys(doc.widgets[0]?.position ?? {})).toEqual(['desktop', 'tablet', 'mobile']);
    expect(doc.theme).toEqual({
      id: theme.id,
      name: theme.name,
      mode: theme.mode,
      tokens: theme.tokens,
    });
  });

  it('creates a UUID v4 id when the layout has none', () => {
    const doc = toDocument(stateFor(fullSnapshot('risk'), { id: undefined }), NOW);
    expect(isUuid(doc.id)).toBe(true);
    expect(uuidVersion(doc.id)).toBe(4);
  });

  it('is pretty-printed with 2-space indents, a trailing newline and no empty fields', () => {
    const snapshot = defaultSnapshot('holdings'); // desktop layout only
    const json = toJSON(stateFor(snapshot), NOW);
    expect(json.startsWith('{\n  "version": "1.0.0",\n  "id": ')).toBe(true);
    expect(json.endsWith('}\n')).toBe(true);
    expect(json).not.toMatch(/null|undefined/);
    // No tablet or mobile layout yet, so each widget has only its desktop position.
    for (const w of parsed(json).widgets) expect(Object.keys(w.position)).toEqual(['desktop']);
    expect(json).not.toContain('"dataSource"');
    expect(json).not.toContain('"collapsed"');
  });

  it('keeps a 15-widget layout under 50 KB', () => {
    const json = toJSON(stateFor(fifteenWidgetSnapshot()), NOW);
    const bytes = serializedBytes(json);
    expect(parsed(json).widgets).toHaveLength(15);
    expect(bytes).toBeLessThan(MAX_LAYOUT_BYTES);
    // Measured at about 11 KB pretty-printed (configs and three positions per widget).
    expect(bytes).toBeLessThan(20 * 1024);
  });
});

describe('LayoutSerializer round trip', () => {
  it.each(PAGE_IDS)('the %s page survives toJSON → fromJSON → toSnapshot unchanged', (page) => {
    const snapshot = fullSnapshot(page);
    const back = toSnapshot(parsed(toJSON(stateFor(snapshot), NOW)), page);
    expect(back.instances).toEqual(snapshot.instances);
    expect(back.grid).toEqual(snapshot.grid ?? back.grid);
    for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
      expect(xywh(back.layouts[bp])).toEqual(xywh(snapshot.layouts[bp]));
    }
  });

  it('the parsed document equals the one written', () => {
    const state = stateFor(fullSnapshot('performance'));
    expect(parsed(toJSON(state, NOW))).toEqual(toDocument(state, NOW));
  });

  it('serialising a loaded layout again gives the same text', () => {
    const json = toJSON(stateFor(fifteenWidgetSnapshot()), NOW);
    const layout = parsed(json);
    const again = toJSON(
      {
        snapshot: toSnapshot(layout, 'workstation'),
        theme: layout.theme,
        meta: layout,
      },
      NOW,
    );
    expect(again).toBe(json);
  });

  it('keeps titles, collapsed state and data source overrides', () => {
    const base = fullSnapshot('risk');
    const [first, ...rest] = base.instances;
    if (!first) throw new Error('empty page');
    const snapshot: PageSnapshot = {
      ...base,
      instances: [
        {
          ...first,
          title: 'VaR (desk)',
          collapsed: { desktop: 5 },
          dataSource: { refreshInterval: 15_000 },
        },
        ...rest,
      ],
    };
    const back = toSnapshot(parsed(toJSON(stateFor(snapshot), NOW)), 'risk');
    expect(back.instances[0]).toEqual(snapshot.instances[0]);
  });

  it('applies to the stores and captures back the same widgets', () => {
    const snapshot = fullSnapshot('research');
    const layout = parsed(toJSON(stateFor(snapshot), NOW));
    const result = applySnapshot('research', toSnapshot(layout, 'research'), true);
    expect(result).toEqual({ applied: snapshot.instances.length, dropped: 0, unknown: 0 });
    const { instances } = useWidgetStore.getState();
    const ids = useDashboardStore.getState().pages.research.itemIds;
    expect(ids.map((id) => instances[id]?.widgetId)).toEqual(
      snapshot.instances.map((i) => i.widgetId),
    );
  });
});

describe('LayoutSerializer.fromJSON validation', () => {
  const valid = () => toDocument(stateFor(fullSnapshot('risk')), NOW);
  const withPatch = (patch: (doc: LayoutDocument) => unknown) =>
    fromJSON(JSON.stringify(patch(valid())), NOW);
  const failure = (result: ReturnType<typeof fromJSON>) => {
    if (result.ok) throw new Error('expected a validation error');
    return result;
  };

  it('rejects text that is not JSON', () => {
    const result = failure(fromJSON('{ "version": "1.0.0", ', NOW));
    expect(result.error).toBe('This is not valid JSON.');
    expect(result.issues).toHaveLength(1);
  });

  it('rejects JSON that is not an object', () => {
    expect(failure(fromJSON('[1, 2]', NOW)).error).toBe('A layout file must be a JSON object.');
    expect(failure(fromJSON('"layout"', NOW)).error).toBe('A layout file must be a JSON object.');
  });

  it('rejects an object without a version that is not an older layout file', () => {
    expect(failure(fromJSON('{"name":"x"}', NOW)).error).toMatch(/"version" field is missing/);
  });

  it('refuses another major format version', () => {
    const result = failure(withPatch((d) => ({ ...d, version: '2.0.0' })));
    expect(result.error).toMatch(/2\.0\.0 is not supported/);
  });

  it('reports each invalid field with its path', () => {
    const result = failure(
      withPatch((d) => ({
        ...d,
        id: 'not-a-uuid',
        widgets: d.widgets.map((w, i) =>
          i === 0 ? { ...w, position: { ...w.position, desktop: { x: 0, y: 0, w: 99, h: 4 } } } : w,
        ),
      })),
    );
    expect(result.error).toBe('Invalid layout file.');
    expect(result.issues).toContain('id: Expected a UUID v4');
    expect(result.issues.some((i) => i.startsWith('widgets.0.position.desktop.w:'))).toBe(true);
  });

  it('rejects a UUID that is not version 4', () => {
    const result = failure(
      withPatch((d) => ({ ...d, id: '1b4e28ba-2fa1-11d2-883f-0016d3cca427' })),
    );
    expect(result.issues).toContain('id: Expected a UUID v4');
  });

  it('rejects duplicate instance ids and widgets wider than the grid', () => {
    const result = failure(
      withPatch((d) => {
        const [a] = d.widgets;
        if (!a) throw new Error('empty');
        return {
          ...d,
          widgets: [a, { ...a, position: { desktop: { x: 10, y: 0, w: 4, h: 4 } } }],
        };
      }),
    );
    expect(result.issues.some((i) => /Duplicate instanceId/.test(i))).toBe(true);
    expect(result.issues.some((i) => /Wider than the 12-column desktop grid/.test(i))).toBe(true);
  });

  it('rejects widget ids that are not kebab case and config values that are objects', () => {
    const result = failure(
      withPatch((d) => ({
        ...d,
        widgets: d.widgets.map((w, i) =>
          i === 0 ? { ...w, widgetId: 'Bad Id', config: { nested: { a: 1 } } } : w,
        ),
      })),
    );
    expect(result.issues.some((i) => i.startsWith('widgets.0.widgetId:'))).toBe(true);
    expect(result.issues.some((i) => i.startsWith('widgets.0.config.nested:'))).toBe(true);
  });

  it('rejects files over 50 KB before parsing them', () => {
    const big = JSON.stringify({ ...valid(), description: 'x'.repeat(MAX_LAYOUT_BYTES) });
    expect(failure(fromJSON(big, NOW)).error).toMatch(/larger than the 50 KB limit/);
  });

  it('removes HTML from names and titles', () => {
    const layout = parsed(
      JSON.stringify({
        ...valid(),
        name: '<img src=x onerror=alert(1)>Risk desk',
        widgets: valid().widgets.map((w, i) => (i === 0 ? { ...w, title: '<b>VaR</b>' } : w)),
      }),
    );
    expect(layout.name).toBe('Risk desk');
    expect(layout.widgets[0]?.title).toBe('VaR');
  });
});

describe('prototype pollution', () => {
  const PAYLOADS = [
    '{"__proto__": {"polluted": "yes"}}',
    '{"constructor": {"prototype": {"polluted": "yes"}}}',
  ];

  it.each(PAYLOADS)('parseJsonSafely drops unsafe keys: %s', (text) => {
    const value = parseJsonSafely(text);
    expect(value).toEqual({});
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(Reflect.get({}, 'polluted')).toBeUndefined();
  });

  it('strips __proto__ and constructor keys anywhere in a layout file', () => {
    const base = toDocument(stateFor(fullSnapshot('risk')), NOW);
    // The first widget gets one setting, so the keys below are inserted into a non-empty object.
    const doc = {
      ...base,
      widgets: base.widgets.map((w, i) => (i === 0 ? { ...w, config: { note: 'kept' } } : w)),
    };
    const text = JSON.stringify(doc)
      .replace('"version":', '"__proto__":{"polluted":"root"},"version":')
      .replace(
        '"config":{',
        '"config":{"__proto__":{"polluted":"config"},"constructor":{"prototype":{"polluted":"ctor"}},',
      )
      .replace('"tokens":{', '"tokens":{"__proto__":{"bg":"#ff0000"},');
    const layout = parsed(text);
    const config = layout.widgets[0]?.config ?? {};
    expect(config).toEqual({ note: 'kept' });
    expect(Object.keys(config)).not.toContain('__proto__');
    expect(Object.keys(config)).not.toContain('constructor');
    expect(Object.getPrototypeOf(config)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(layout)).toBe(Object.prototype);
    expect(layout.theme.tokens.bg).toBe(theme.tokens.bg);
    expect(Reflect.get({}, 'polluted')).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
});

describe('unknown widgets and older files', () => {
  it('loads unknown widget ids as placeholders instead of dropping them', () => {
    const doc = toDocument(stateFor(fullSnapshot('risk')), NOW);
    const [first] = doc.widgets;
    if (!first) throw new Error('empty');
    const text = JSON.stringify({
      ...doc,
      widgets: [
        ...doc.widgets,
        {
          ...first,
          instanceId: 'risk-from-a-plugin',
          widgetId: 'esg-scorecard',
          position: { desktop: { x: 0, y: 40, w: 4, h: 4 } },
        },
      ],
    });
    const result = fromJSON(text, NOW);
    if (!result.ok) throw new Error(result.error);
    expect(result.unknownWidgetIds).toEqual(['esg-scorecard']);

    const snapshot = toSnapshot(result.layout, 'risk');
    const applied = applySnapshot('risk', snapshot, true);
    expect(applied.unknown).toBe(1);
    expect(applied.applied).toBe(doc.widgets.length + 1);
    expect(useWidgetStore.getState().instances['risk-from-a-plugin']?.widgetId).toBe(
      'esg-scorecard',
    );
    // Only the desktop placement was given, so the other breakpoints are derived again.
    expect(snapshot.layouts.tablet).toBeUndefined();
  });

  it('reads files in the older bare-snapshot format, without a theme', () => {
    const legacy = JSON.stringify(defaultSnapshot('research'));
    const result = fromJSON(legacy, NOW);
    if (!result.ok) throw new Error(result.error);
    expect(result.hasTheme).toBe(false);
    expect(result.layout.version).toBe(LAYOUT_FORMAT_VERSION);
    expect(result.layout.widgets.map((w) => w.widgetId)).toEqual(
      defaultSnapshot('research').instances.map((i) => i.widgetId),
    );
  });

  it('drops tablet positions written for a different tablet column count', () => {
    const doc = toDocument(stateFor(fullSnapshot('risk')), NOW);
    const text = JSON.stringify({
      ...doc,
      breakpoints: { ...doc.breakpoints, tablet: { minWidth: 768, cols: 8 } },
    });
    const snapshot = toSnapshot(parsed(text), 'risk');
    expect(snapshot.layouts.tablet).toBeUndefined();
    expect(snapshot.layouts.mobile).toHaveLength(doc.widgets.length);
  });

  it('exposes the API as one object', () => {
    expect(LayoutSerializer.version).toBe('1.0.0');
    expect(LayoutSerializer.toJSON).toBe(toJSON);
    expect(LayoutSerializer.fromJSON).toBe(fromJSON);
    expect(BUILT_IN_THEMES.some((t) => t.id === theme.id)).toBe(true);
  });
});
