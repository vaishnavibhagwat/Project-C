import type { JSONSchema7 } from 'json-schema';
import { lazy } from 'react';
import { describe, expect, it } from 'vitest';
import { configErrorsByField, validateWidgetConfig } from '@/registry/configValidator';
import { validateWidgetDefinition } from '@/registry/definitionValidator';
import {
  DuplicateWidgetError,
  InvalidWidgetDefinitionError,
  WidgetRegistry,
} from '@/registry/WidgetRegistry';
import {
  WidgetCategory,
  type WidgetComponentType,
  type WidgetConfig,
  type WidgetDefinition,
} from '@/types';

const Empty = () => null;

const SCHEMA: JSONSchema7 = {
  type: 'object',
  properties: {
    range: { title: 'Range', oneOf: [{ const: '1Y' }, { const: '5Y' }] },
    limit: { type: 'number', minimum: 0.5, maximum: 5, multipleOf: 0.5 },
    showLegend: { type: 'boolean' },
  },
};

function makeWidget(overrides: Partial<WidgetDefinition> = {}): WidgetDefinition {
  return {
    id: 'test-widget',
    name: 'Test widget',
    description: 'A widget used by the registry tests.',
    category: WidgetCategory.CHART,
    defaultSize: { w: 4, h: 8 },
    minSize: { w: 2, h: 4 },
    maxSize: { w: 12, h: 20 },
    configSchema: SCHEMA,
    defaultConfig: { range: '1Y', limit: 2, showLegend: true },
    component: lazy<WidgetComponentType<WidgetConfig, unknown>>(() =>
      Promise.resolve({ default: Empty }),
    ),
    icon: Empty,
    dataSource: { endpoint: 'risk/var', refreshInterval: 30_000, latencyProfile: 'normal' },
    ...overrides,
  };
}

/** A copy of a definition without one field (to test missing fields without casts). */
function without(definition: WidgetDefinition, field: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(definition).filter(([key]) => key !== field));
}

describe('WidgetRegistry', () => {
  it('registers a widget and returns it by id', () => {
    const registry = new WidgetRegistry();
    const widget = makeWidget();
    registry.registerWidget(widget);
    expect(registry.getWidget('test-widget')).toBe(widget);
    expect(registry.hasWidget('test-widget')).toBe(true);
    expect(registry.size).toBe(1);
  });

  it('returns undefined for an id that was never registered', () => {
    const registry = new WidgetRegistry();
    expect(registry.getWidget('missing')).toBeUndefined();
    expect(registry.hasWidget('missing')).toBe(false);
  });

  it('lists every widget in registration order, as a copy', () => {
    const registry = new WidgetRegistry();
    for (const id of ['c-widget', 'a-widget', 'b-widget'])
      registry.registerWidget(makeWidget({ id }));
    const all = registry.getAllWidgets();
    expect(all.map((w) => w.id)).toEqual(['c-widget', 'a-widget', 'b-widget']);
    all.pop();
    expect(registry.getAllWidgets()).toHaveLength(3);
  });

  it('filters widgets by category', () => {
    const registry = new WidgetRegistry();
    registry.registerWidget(makeWidget({ id: 'chart-one' }));
    registry.registerWidget(makeWidget({ id: 'table-one', category: WidgetCategory.TABLE }));
    registry.registerWidget(makeWidget({ id: 'chart-two' }));
    expect(registry.getWidgetsByCategory(WidgetCategory.CHART).map((w) => w.id)).toEqual([
      'chart-one',
      'chart-two',
    ]);
    expect(registry.getWidgetsByCategory(WidgetCategory.TABLE).map((w) => w.id)).toEqual([
      'table-one',
    ]);
    expect(registry.getWidgetsByCategory(WidgetCategory.GAUGE)).toEqual([]);
  });

  it('unregisters a widget, reports unknown ids, and frees the id for reuse', () => {
    const registry = new WidgetRegistry();
    registry.registerWidget(makeWidget());
    expect(registry.unregisterWidget('test-widget')).toBe(true);
    expect(registry.getWidget('test-widget')).toBeUndefined();
    expect(registry.unregisterWidget('test-widget')).toBe(false);
    const again = makeWidget({ name: 'Second registration' });
    registry.registerWidget(again);
    expect(registry.getWidget('test-widget')).toBe(again);
  });

  it('rejects a duplicate id and keeps the original', () => {
    const registry = new WidgetRegistry();
    const original = makeWidget();
    registry.registerWidget(original);
    expect(() => registry.registerWidget(makeWidget({ name: 'Impostor' }))).toThrow(
      DuplicateWidgetError,
    );
    expect(() => registry.registerWidget(makeWidget())).toThrow(/"test-widget" is already/);
    expect(registry.getWidget('test-widget')).toBe(original);
    expect(registry.size).toBe(1);
  });

  it('rejects an invalid definition, lists every problem, and registers nothing', () => {
    const registry = new WidgetRegistry();
    const broken = makeWidget({
      id: 'Bad Id',
      name: '   ',
      dataSource: { endpoint: 'risk/var', refreshInterval: 10, latencyProfile: 'low' },
    });
    let thrown: unknown;
    try {
      registry.registerWidget(broken);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(InvalidWidgetDefinitionError);
    const errors = thrown instanceof InvalidWidgetDefinitionError ? thrown.errors : [];
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^id: must be kebab-case/),
        expect.stringMatching(/^name: must not be empty/),
        expect.stringMatching(/^dataSource\.refreshInterval: must be at least 1000 ms/),
      ]),
    );
    expect(registry.size).toBe(0);
  });

  it("validates a config against the registered widget's configSchema", () => {
    const registry = new WidgetRegistry();
    registry.registerWidget(makeWidget());
    expect(registry.validateConfig('test-widget', { range: '5Y', limit: 4.5 })).toEqual({
      valid: true,
      errors: [],
    });
    const result = registry.validateConfig('test-widget', { limit: 9 });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      { path: 'limit', keyword: 'maximum', message: 'Maximum is 5.' },
    ]);
    expect(registry.validateConfig('missing', {}).errors[0]?.message).toBe(
      'Unknown widget "missing".',
    );
  });
});

describe('validateWidgetDefinition', () => {
  it('accepts a complete definition, with or without the optional maxSize', () => {
    expect(validateWidgetDefinition(makeWidget())).toEqual({ valid: true, errors: [] });
    expect(validateWidgetDefinition(without(makeWidget(), 'maxSize')).valid).toBe(true);
  });

  it('rejects values that are not objects', () => {
    expect(validateWidgetDefinition(null).valid).toBe(false);
    expect(validateWidgetDefinition('var-gauge').valid).toBe(false);
  });

  it.each([
    'id',
    'name',
    'description',
    'category',
    'defaultSize',
    'minSize',
    'configSchema',
    'defaultConfig',
    'component',
    'icon',
    'dataSource',
  ])('reports a missing %s', (field) => {
    const result = validateWidgetDefinition(without(makeWidget(), field));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${field}: Required`);
  });

  const valid = makeWidget();
  it.each<[string, Record<string, unknown>, string]>([
    ['an id that is not kebab-case', { id: 'Var Gauge' }, 'id: must be kebab-case'],
    ['an empty description', { description: '' }, 'description: must not be empty'],
    ['an unknown category', { category: 'MAP' }, 'category: '],
    ['a non-positive size', { defaultSize: { w: 0, h: 8 } }, 'defaultSize.w: '],
    ['a fractional size', { minSize: { w: 2.5, h: 4 } }, 'minSize.w: '],
    [
      'minSize larger than defaultSize',
      { minSize: { w: 6, h: 4 } },
      'minSize.w: must not exceed defaultSize.w (4)',
    ],
    [
      'defaultSize larger than maxSize',
      { maxSize: { w: 12, h: 6 } },
      'defaultSize.h: must not exceed maxSize.h (6)',
    ],
    ['a component that is not lazy', { component: Empty }, 'component: must be a React.lazy()'],
    ['an icon that is not a component', { icon: 'shield' }, 'icon: must be a React component'],
    [
      'an unknown endpoint',
      { dataSource: { ...valid.dataSource, endpoint: 'prices/live' } },
      'dataSource.endpoint: is not a known mock API endpoint',
    ],
    [
      'an unknown latency profile',
      { dataSource: { ...valid.dataSource, latencyProfile: 'fast' } },
      'dataSource.latencyProfile: ',
    ],
    [
      'an empty wsChannel',
      { dataSource: { ...valid.dataSource, wsChannel: '' } },
      'dataSource.wsChannel: ',
    ],
    [
      'a configSchema that is not an object schema',
      { configSchema: { type: 'array' } },
      'configSchema.type: must be "object"',
    ],
    [
      'a configSchema keyword the validator does not support',
      {
        configSchema: { type: 'object', properties: { note: { type: 'string', format: 'email' } } },
      },
      "configSchema.properties.note: Unrecognized key(s) in object: 'format'",
    ],
    [
      'a configSchema keyword with the wrong value type',
      { configSchema: { type: 'object', properties: { limit: { maximum: '5' } } } },
      'configSchema.properties.limit.maximum: ',
    ],
    [
      'a default that breaks the configSchema',
      { defaultConfig: { range: '1Y', limit: 9, showLegend: true } },
      'defaultConfig.limit: Maximum is 5.',
    ],
    [
      'a setting without a default',
      { defaultConfig: { range: '1Y', limit: 2 } },
      'defaultConfig.showLegend: missing a default',
    ],
    [
      'a default the configSchema does not describe',
      { defaultConfig: { range: '1Y', limit: 2, showLegend: true, extra: 1 } },
      'defaultConfig.extra: is not described by configSchema',
    ],
    [
      'a default that is not a plain value',
      { defaultConfig: { range: '1Y', limit: 2, showLegend: [true] } },
      'defaultConfig.showLegend: ',
    ],
  ])('rejects %s', (_, patch, expected) => {
    const result = validateWidgetDefinition({ ...valid, ...patch });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining(expected)]));
  });
});

describe('validateWidgetConfig', () => {
  const schema: JSONSchema7 = {
    type: 'object',
    properties: {
      range: { oneOf: [{ const: '1Y' }, { const: '5Y' }] },
      show: { type: 'boolean' },
      limit: { type: 'number', minimum: 0.5, maximum: 5, multipleOf: 0.1 },
      days: { type: 'integer', minimum: 1 },
      note: { type: 'string', maxLength: 3 },
    },
  };

  it('accepts a valid config, and a partial one (stored settings merge over defaults)', () => {
    const full = { range: '1Y', show: true, limit: 2.3, days: 3, note: 'ok' };
    expect(validateWidgetConfig(full, schema)).toEqual({ valid: true, errors: [] });
    expect(validateWidgetConfig({ limit: 0.7 }, schema).valid).toBe(true);
  });

  it('reports option, type, range, step and length problems per field', () => {
    const result = validateWidgetConfig(
      { range: '3Y', show: 'yes', limit: 9, days: 1.5, note: 'long' },
      schema,
    );
    expect(result.valid).toBe(false);
    expect(configErrorsByField(result)).toEqual({
      range: 'Must be one of: 1Y, 5Y.',
      show: 'Expected true or false.',
      limit: 'Maximum is 5.',
      days: 'Enter a whole number.',
      note: 'At most 3 characters.',
    });
    expect(configErrorsByField(validateWidgetConfig({ limit: 2.25 }, schema))).toEqual({
      limit: 'Must be a multiple of 0.1.',
    });
  });

  it('treats NaN (an empty number field) as a missing number', () => {
    expect(configErrorsByField(validateWidgetConfig({ limit: Number.NaN }, schema))).toEqual({
      limit: 'Enter a number.',
    });
  });

  it('enforces required and additionalProperties when the schema sets them', () => {
    const strict: JSONSchema7 = { ...schema, required: ['range'], additionalProperties: false };
    expect(validateWidgetConfig({ extra: 1 }, strict).errors).toEqual([
      { path: 'range', keyword: 'required', message: 'Required.' },
      { path: 'extra', keyword: 'additionalProperties', message: 'Unknown setting.' },
    ]);
  });

  it('only accepts flat objects of text, numbers and booleans', () => {
    expect(validateWidgetConfig(null, schema).errors[0]?.message).toBe('Expected an object.');
    expect(validateWidgetConfig(['1Y'], schema).valid).toBe(false);
    expect(configErrorsByField(validateWidgetConfig({ extra: { nested: 1 } }, schema))).toEqual({
      extra: 'Expected text, a number or true/false.',
    });
  });

  it('fails closed on keywords it does not understand', () => {
    const unsupported: JSONSchema7 = {
      type: 'object',
      properties: { email: { type: 'string', format: 'email' } },
    };
    const result = validateWidgetConfig({ email: 'not-an-email' }, unsupported);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatchObject({ path: 'email', keyword: 'format' });
  });
});
