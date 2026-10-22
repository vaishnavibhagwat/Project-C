import { beforeEach, describe, expect, it } from 'vitest';
import { migrateWidgetState, useWidgetStore } from '@/store/widgetStore';

const initial = useWidgetStore.getState();
const store = () => useWidgetStore.getState();
const NAV = 'workstation-nav-performance';

beforeEach(() => useWidgetStore.setState(initial, true));

describe('WidgetStore', () => {
  it('starts with every default page instance, keyed by instanceId', () => {
    const instance = store().instances[NAV];
    expect(instance).toMatchObject({ instanceId: NAV, widgetId: 'nav-performance', config: {} });
    for (const [id, inst] of Object.entries(store().instances)) expect(inst.instanceId).toBe(id);
  });

  it('createInstance adds an instance with a fresh id and returns it', () => {
    const position = { x: 0, y: 4, w: 6, h: 5 };
    const id = store().createInstance('var-gauge', position, { confidence: '95' }, 'Desk VaR');
    expect(id).toMatch(/^var-gauge-[0-9a-f-]{36}$/);
    expect(store().instances[id]).toEqual({
      instanceId: id,
      widgetId: 'var-gauge',
      config: { confidence: '95' },
      position,
      title: 'Desk VaR',
    });
  });

  it('upsertInstances inserts new instances and replaces existing ones', () => {
    const nav = initial.instances[NAV];
    if (!nav) throw new Error('missing default instance');
    const replaced = { ...nav, title: 'Replaced' };
    const added = { ...replaced, instanceId: 'extra', title: 'Extra' };
    store().upsertInstances([replaced, added]);
    expect(store().instances[NAV]?.title).toBe('Replaced');
    expect(store().instances.extra?.title).toBe('Extra');
  });

  it('updateConfig merges a patch and skips undefined values', () => {
    store().updateConfig(NAV, { range: '5Y' });
    store().updateConfig(NAV, { showBenchmark: false, range: undefined });
    expect(store().instances[NAV]?.config).toEqual({ range: '5Y', showBenchmark: false });
    store().updateConfig('missing', { range: '1Y' });
    expect(store().instances.missing).toBeUndefined();
  });

  it('replaceConfig swaps the whole config', () => {
    store().updateConfig(NAV, { range: '5Y' });
    store().replaceConfig(NAV, { mode: 'absolute' });
    expect(store().instances[NAV]?.config).toEqual({ mode: 'absolute' });
  });

  it('renameInstance sets and clears a custom title', () => {
    store().renameInstance(NAV, 'Fund NAV');
    expect(store().instances[NAV]?.title).toBe('Fund NAV');
    store().renameInstance(NAV, undefined);
    expect(store().instances[NAV]?.title).toBeUndefined();
  });

  it('setPositions mirrors placements and ignores unknown ids', () => {
    store().setPositions({ [NAV]: { x: 6, y: 0, w: 6, h: 4 }, ghost: { x: 0, y: 0, w: 1, h: 1 } });
    expect(store().instances[NAV]?.position).toEqual({ x: 6, y: 0, w: 6, h: 4 });
    expect(store().instances.ghost).toBeUndefined();
  });

  it('removeInstances deletes instances and closes their open settings', () => {
    store().openSettings(NAV);
    store().removeInstances([NAV]);
    expect(store().instances[NAV]).toBeUndefined();
    expect(store().settingsFor).toBeNull();
  });

  it('duplicateInstance copies settings into a new instance', () => {
    store().updateConfig(NAV, { range: '3Y' });
    const position = { x: 0, y: 30, w: 6, h: 5 };
    const copy = store().duplicateInstance(NAV, position, 'NAV (copy)');
    if (!copy) throw new Error('expected a copy');
    expect(copy).not.toBe(NAV);
    expect(store().instances[copy]).toMatchObject({
      widgetId: 'nav-performance',
      config: { range: '3Y' },
      position,
      title: 'NAV (copy)',
    });
    // The copy's config is independent of the original.
    store().updateConfig(NAV, { range: '1Y' });
    expect(store().instances[copy]?.config.range).toBe('3Y');
    expect(store().duplicateInstance('missing', position)).toBeNull();
  });

  it('openSettings and closeSettings track the settings drawer', () => {
    store().openSettings(NAV);
    expect(store().settingsFor).toBe(NAV);
    store().closeSettings();
    expect(store().settingsFor).toBeNull();
  });

  it('migrates version 1 positions from 28 px rows', () => {
    const legacy = {
      instances: {
        a: {
          instanceId: 'a',
          widgetId: 'drawdown',
          config: {},
          position: { x: 0, y: 34, w: 6, h: 8 },
        },
      },
    };
    expect(migrateWidgetState(legacy, 1)?.instances.a?.position).toEqual({
      x: 0,
      y: 18,
      w: 6,
      h: 4,
    });
    expect(migrateWidgetState(legacy, 2)?.instances.a?.position.h).toBe(8);
    expect(migrateWidgetState({ instances: 'nope' }, 1)).toBeNull();
  });
});
