import { beforeEach, describe, expect, it } from 'vitest';
import { selectPaintedTheme, useThemeStore } from '@/store/themeStore';
import { DEFAULT_THEME_ID, MIDNIGHT_GRAPHITE } from '@/theme/themes';

const initial = useThemeStore.getState();
const store = () => useThemeStore.getState();

beforeEach(() => useThemeStore.setState(initial, true));

/** Save a custom theme based on Porcelain and return its id. */
function saveCustom(name = 'Desk light'): string {
  store().openBuilder('porcelain');
  store().setDraftName(name);
  const id = store().saveDraft();
  if (!id) throw new Error('expected a saved theme');
  return id;
}

describe('ThemeStore', () => {
  it('starts on Midnight Graphite with no custom themes', () => {
    expect(store().activeThemeId).toBe(DEFAULT_THEME_ID);
    expect(store().customThemes).toEqual([]);
  });

  it('setActiveTheme switches themes and falls back to the default for unknown ids', () => {
    store().setActiveTheme('porcelain');
    expect(store().activeThemeId).toBe('porcelain');
    store().setActiveTheme('does-not-exist');
    expect(store().activeThemeId).toBe(DEFAULT_THEME_ID);
  });

  it('openBuilder copies a built-in theme into a new custom draft', () => {
    store().openBuilder('porcelain');
    const { open, draft } = store().builder;
    expect(open).toBe(true);
    expect(draft?.id).toMatch(/^theme-/);
    expect(draft?.name).toBe('Porcelain (custom)');
    expect(draft?.builtIn).toBe(false);
  });

  it('openBuilder edits an existing custom theme in place', () => {
    const id = saveCustom();
    store().openBuilder(id);
    expect(store().builder.draft?.id).toBe(id);
  });

  it('closeBuilder discards the draft and stops the preview', () => {
    store().openBuilder();
    store().setDraftToken('accent', '#ff00ff');
    expect(selectPaintedTheme(store()).tokens.accent).toBe('#ff00ff');
    store().closeBuilder();
    expect(store().builder).toEqual({ open: false, draft: null });
    expect(selectPaintedTheme(store()).id).toBe(DEFAULT_THEME_ID);
  });

  it('setDraftToken accepts #RRGGBB (lower-cased) and ignores anything else', () => {
    store().openBuilder();
    store().setDraftToken('accent', '#AABBCC');
    store().setDraftToken('positive', 'red');
    expect(store().builder.draft?.tokens.accent).toBe('#aabbcc');
    expect(store().builder.draft?.tokens.positive).toBe(MIDNIGHT_GRAPHITE.tokens.positive);
  });

  it('setDraftName keeps at most 40 characters', () => {
    store().openBuilder();
    store().setDraftName('x'.repeat(60));
    expect(store().builder.draft?.name).toHaveLength(40);
  });

  it('setDraftMode switches between dark and light', () => {
    store().openBuilder();
    store().setDraftMode('light');
    expect(store().builder.draft?.mode).toBe('light');
  });

  it('saveDraft stores a sanitised custom theme, activates it, and updates on re-save', () => {
    expect(store().saveDraft()).toBeNull();
    const id = saveCustom('<b>Desk</b> light');
    expect(store().activeThemeId).toBe(id);
    expect(store().customThemes).toHaveLength(1);
    expect(store().customThemes[0]?.name).toBe('Desk light');
    store().openBuilder(id);
    store().setDraftName('Renamed');
    store().saveDraft();
    expect(store().customThemes).toHaveLength(1);
    expect(store().customThemes[0]?.name).toBe('Renamed');
  });

  it('deleteCustomTheme removes it and falls back to the default when it was active', () => {
    const id = saveCustom();
    store().deleteCustomTheme(id);
    expect(store().customThemes).toEqual([]);
    expect(store().activeThemeId).toBe(DEFAULT_THEME_ID);
  });

  it('importTheme rejects invalid JSON and imports valid themes under a new id', () => {
    const bad = store().importTheme({ name: 'x', tokens: { bg: 'red' } });
    expect(bad.ok).toBe(false);
    const good = store().importTheme({ ...MIDNIGHT_GRAPHITE, name: '<i>Night</i>' });
    if (!good.ok) throw new Error(good.error);
    expect(good.id).not.toBe(MIDNIGHT_GRAPHITE.id);
    expect(store().activeThemeId).toBe(good.id);
    expect(store().customThemes.at(-1)).toMatchObject({ name: 'Night', builtIn: false });
  });

  it('importTheme keeps at most 20 custom themes', () => {
    for (let i = 0; i < 22; i += 1) store().importTheme({ ...MIDNIGHT_GRAPHITE, name: `T${i}` });
    expect(store().customThemes).toHaveLength(20);
    expect(store().customThemes[0]?.name).toBe('T2');
  });
});
