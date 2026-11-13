import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSnapshot } from '@/registry/pages';
import { MAX_SHARES, MAX_VERSIONS, selectVersions, useLayoutStore } from '@/store/layoutStore';

const initial = useLayoutStore.getState();
const store = () => useLayoutStore.getState();
const T0 = '2026-10-20T10:00:00+05:30';
const T1 = '2026-10-20T11:00:00+05:30';

beforeEach(() => useLayoutStore.setState(initial, true));

function share(n: number) {
  return {
    page: 'risk' as const,
    url: `http://localhost/#/risk?share=link${n}`,
    bytes: 1200,
    createdAt: T0,
  };
}

describe('LayoutStore', () => {
  it('starts empty', () => {
    expect(store().savedLayouts).toEqual([]);
    expect(store().activeByPage).toEqual({});
    expect(store().shares).toEqual([]);
  });

  it('saveLayout stores version 1 with a sanitised name and marks it active', () => {
    const id = store().saveLayout('<b>Desk</b> view', defaultSnapshot('risk'), T0);
    const layout = store().savedLayouts[0];
    expect(layout).toMatchObject({ id, name: 'Desk view', page: 'risk', createdAt: T0 });
    expect(layout?.versions).toEqual([
      { version: 1, createdAt: T0, note: 'Initial save', snapshot: defaultSnapshot('risk') },
    ]);
    expect(store().activeByPage.risk).toBe(id);
    expect(store().saveLayout('   ', defaultSnapshot('risk'), T0)).not.toBe(id);
    expect(store().savedLayouts[1]?.name).toBe('Untitled layout');
  });

  it('saveVersion appends numbered versions and keeps the newest MAX_VERSIONS', () => {
    const id = store().saveLayout('Desk', defaultSnapshot('risk'), T0);
    expect(store().saveVersion(id, defaultSnapshot('risk'), 'added holdings', T1)).toBe(2);
    const layout = store().savedLayouts[0];
    expect(layout?.updatedAt).toBe(T1);
    expect(selectVersions(store(), id).map((v) => [v.version, v.note])).toEqual([
      [1, 'Initial save'],
      [2, 'added holdings'],
    ]);
    for (let i = 0; i < MAX_VERSIONS + 5; i += 1)
      store().saveVersion(id, defaultSnapshot('risk'), '', T1);
    const versions = selectVersions(store(), id);
    expect(versions).toHaveLength(MAX_VERSIONS);
    expect(versions.at(-1)?.note).toBe(`Version ${MAX_VERSIONS + 7}`);
    expect(store().saveVersion('missing', defaultSnapshot('risk'), '', T1)).toBeNull();
    expect(selectVersions(store(), 'missing')).toEqual([]);
  });

  it('renameLayout sanitises the new name', () => {
    const id = store().saveLayout('Desk', defaultSnapshot('risk'), T0);
    store().renameLayout(id, '<script>x</script>Morning');
    expect(store().savedLayouts[0]?.name).toBe('Morning');
  });

  it('deleteLayout removes it and clears the active marker', () => {
    const id = store().saveLayout('Temp', defaultSnapshot('risk'), T0);
    store().deleteLayout(id);
    expect(store().savedLayouts).toEqual([]);
    expect(store().activeByPage.risk).toBeUndefined();
  });

  it('setActive marks and clears the layout loaded on a page', () => {
    store().setActive('holdings', 'layout-1');
    expect(store().activeByPage.holdings).toBe('layout-1');
    store().setActive('holdings', null);
    expect(store().activeByPage.holdings).toBeUndefined();
  });

  it('recordShare keeps the newest MAX_SHARES links, newest first', () => {
    const first = store().recordShare(share(0));
    expect(store().shares[0]).toEqual({ ...share(0), id: first });
    for (let n = 1; n <= MAX_SHARES + 2; n += 1) store().recordShare(share(n));
    expect(store().shares).toHaveLength(MAX_SHARES);
    expect(store().shares[0]?.url).toContain(`link${MAX_SHARES + 2}`);
  });

  it('removeShare and clearShares forget links', () => {
    const a = store().recordShare(share(1));
    store().recordShare(share(2));
    store().removeShare(a);
    expect(store().shares.map((s) => s.url)).toEqual([share(2).url]);
    store().clearShares();
    expect(store().shares).toEqual([]);
  });

  it('rehydrates version 1 storage, where the list was called "saved"', async () => {
    store().saveLayout('Old desk', defaultSnapshot('risk'), T0);
    const v1 = { saved: store().savedLayouts, activeByPage: {} };
    useLayoutStore.setState(initial, true);
    localStorage.setItem('meridian:layouts', JSON.stringify({ state: v1, version: 1 }));
    await useLayoutStore.persist.rehydrate();
    expect(store().savedLayouts.map((l) => l.name)).toEqual(['Old desk']);
    expect(store().shares).toEqual([]);
  });

  it('keeps the last 10 versions per layout', () => {
    expect(MAX_VERSIONS).toBe(10);
    const id = store().saveLayout('Desk', defaultSnapshot('risk'), T0);
    for (let i = 0; i < 12; i += 1) store().saveVersion(id, defaultSnapshot('risk'), '', T1);
    expect(selectVersions(store(), id).map((v) => v.version)).toEqual([
      4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
  });

  it('saveLayout stores a description, and updateDetails changes name and description', () => {
    const id = store().saveLayout(
      'Desk',
      defaultSnapshot('risk'),
      T0,
      'Morning <i>risk</i> review',
    );
    expect(store().savedLayouts[0]?.description).toBe('Morning risk review');
    store().updateDetails(id, 'Desk v2', '<b>Updated</b>', T1);
    expect(store().savedLayouts[0]).toMatchObject({
      name: 'Desk v2',
      description: 'Updated',
      updatedAt: T1,
    });
  });

  it('duplicateLayout copies a layout, versions included, under a new UUID', () => {
    const id = store().saveLayout('Desk', defaultSnapshot('risk'), T0, 'note');
    store().saveVersion(id, defaultSnapshot('holdings'), 'second', T0);
    const copy = store().duplicateLayout(id, T1);
    expect(copy).not.toBeNull();
    expect(copy).not.toBe(id);
    expect(copy).toMatch(
      /^layout-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const [original, cloned] = store().savedLayouts;
    expect(cloned).toMatchObject({
      id: copy,
      name: 'Desk (copy)',
      description: 'note',
      createdAt: T1,
    });
    expect(cloned?.versions).toEqual(original?.versions);
    // A deep copy: changing the copy leaves the original alone.
    store().saveVersion(copy ?? '', defaultSnapshot('research'), 'only copy', T1);
    expect(original?.versions).toHaveLength(2);
    expect(store().duplicateLayout('missing', T1)).toBeNull();
  });

  it('revertToVersion saves the old version as the newest one', () => {
    const id = store().saveLayout('Desk', defaultSnapshot('risk'), T0);
    store().saveVersion(id, defaultSnapshot('holdings'), 'holdings', T0);
    expect(store().revertToVersion(id, 1, T1)).toBe(3);
    const versions = selectVersions(store(), id);
    expect(versions.map((v) => [v.version, v.note])).toEqual([
      [1, 'Initial save'],
      [2, 'holdings'],
      [3, 'Reverted to v1'],
    ]);
    expect(versions[2]?.snapshot).toEqual(defaultSnapshot('risk'));
    expect(store().revertToVersion(id, 99, T1)).toBeNull();
    expect(store().revertToVersion('missing', 1, T1)).toBeNull();
  });

  it('upgrades version 2 storage: no descriptions and up to 20 versions', async () => {
    const id = store().saveLayout('Old desk', defaultSnapshot('risk'), T0);
    const old = store().savedLayouts[0];
    if (!old) throw new Error('not saved');
    const versions = Array.from({ length: 20 }, (_, i) => ({
      ...old.versions[0],
      version: i + 1,
      note: `v${i + 1}`,
    }));
    const v2 = {
      savedLayouts: [
        {
          id: old.id,
          name: old.name,
          page: old.page,
          createdAt: old.createdAt,
          updatedAt: old.updatedAt,
          versions,
        },
      ],
      activeByPage: { risk: id },
      shares: [],
    };
    useLayoutStore.setState(initial, true);
    localStorage.setItem('meridian:layouts', JSON.stringify({ state: v2, version: 2 }));
    await useLayoutStore.persist.rehydrate();
    const [layout] = store().savedLayouts;
    expect(layout?.description).toBe('');
    expect(layout?.versions.map((v) => v.version)).toEqual([
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
    expect(store().lastValidByPage).toEqual({});
  });
});
