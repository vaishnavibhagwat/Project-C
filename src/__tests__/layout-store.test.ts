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
});
