import { getPageMeta } from '@/registry/pages';
import { applySnapshot, captureSnapshot, type ApplyResult, resetPage } from '@/store/actions';
import { useLayoutStore } from '@/store/layoutStore';
import { allThemes, resolveTheme, useThemeStore } from '@/store/themeStore';
import type { Layout, PageId } from '@/types';
import { downloadText } from '@/utils/download';
import {
  fromJSON,
  toJSON,
  toSnapshot,
  type DashboardState,
  type FromJsonResult,
  type LayoutTheme,
} from './LayoutSerializer';
import { CURRENT_USER } from './UserMenu';

/** Layout files and the stores: export a page, import a file, recover from a bad one. */

/** Saved layout ids are "layout-<uuid v4>"; the file id is the uuid part. */
function fileIdFor(layout: Layout): string {
  return layout.id.replace(/^layout-/, '');
}

function currentTheme() {
  const { activeThemeId, customThemes } = useThemeStore.getState();
  return resolveTheme(activeThemeId, customThemes);
}

/** The page as it is now. Uses the page's active saved layout for the name and id, if any. */
export function captureDashboard(page: PageId): DashboardState {
  const meta = getPageMeta(page);
  const { savedLayouts, activeByPage } = useLayoutStore.getState();
  const active = savedLayouts.find((l) => l.id === activeByPage[page]);
  return {
    snapshot: captureSnapshot(page),
    theme: currentTheme(),
    meta: {
      ...(active ? { id: fileIdFor(active), createdAt: active.createdAt } : {}),
      name: active?.name ?? `${meta.short} layout`,
      description: meta.description,
      createdBy: CURRENT_USER.name,
    },
  };
}

/** A saved layout's latest version as layout JSON. */
export function savedLayoutJson(layout: Layout): string | null {
  const latest = layout.versions[layout.versions.length - 1];
  if (!latest) return null;
  return toJSON({
    snapshot: latest.snapshot,
    theme: currentTheme(),
    meta: {
      id: fileIdFor(layout),
      name: layout.name,
      description: getPageMeta(layout.page).description,
      createdAt: layout.createdAt,
      updatedAt: layout.updatedAt,
      createdBy: CURRENT_USER.name,
    },
  });
}

function fileName(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'layout';
  return `${slug}.layout.json`;
}

/** Download a page's layout JSON and remember it as the page's last valid layout. */
export function exportPageLayout(page: PageId): void {
  const state = captureDashboard(page);
  const json = toJSON(state);
  useLayoutStore.getState().setLastValid(page, json);
  downloadText(fileName(state.meta.name), json, 'application/json');
}

export function exportSavedLayout(layout: Layout): void {
  const json = savedLayoutJson(layout);
  if (json === null) return;
  useLayoutStore.getState().setLastValid(layout.page, json);
  downloadText(fileName(layout.name), json, 'application/json');
}

/**
 * Use the file's theme: a theme with the same id and colours if one exists (built-in or
 * custom), otherwise a new custom theme. Returns the id now active.
 */
function applyLayoutTheme(theme: LayoutTheme): string {
  const store = useThemeStore.getState();
  const key = (tokens: LayoutTheme['tokens']) => JSON.stringify(Object.entries(tokens).sort());
  const same = (a: LayoutTheme['tokens'], b: LayoutTheme['tokens']) => key(a) === key(b);
  const match =
    allThemes(store.customThemes).find((t) => t.id === theme.id && same(t.tokens, theme.tokens)) ??
    store.customThemes.find((t) => t.name === theme.name && same(t.tokens, theme.tokens));
  if (match) {
    store.setActiveTheme(match.id);
    return match.id;
  }
  const imported = store.importTheme({ ...theme, builtIn: false });
  return imported.ok ? imported.id : store.activeThemeId;
}

export type ImportOutcome =
  { ok: true; result: ApplyResult; name: string } | Extract<FromJsonResult, { ok: false }>;

/**
 * Validate layout JSON and, if it is valid, apply it to `page` (undoable) with its theme.
 * Nothing changes when it is invalid.
 */
export function importLayoutJson(page: PageId, json: string): ImportOutcome {
  const parsed = fromJSON(json);
  if (!parsed.ok) return parsed;
  const result = applySnapshot(page, toSnapshot(parsed.layout, page), false, 'Import layout');
  if (parsed.hasTheme) applyLayoutTheme(parsed.layout.theme);
  useLayoutStore.getState().setLastValid(page, json);
  return { ok: true, result, name: parsed.layout.name };
}

/** The page's last valid layout JSON, if there is one. */
export function lastValidLayout(page: PageId): string | null {
  return useLayoutStore.getState().lastValidByPage[page] ?? null;
}

/** "Start fresh": the page's default layout (undoable, like Reset layout). */
export function startFresh(page: PageId): void {
  resetPage(page);
}
