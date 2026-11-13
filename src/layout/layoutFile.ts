import { startTransition } from 'react';
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

/** A saved layout's latest version (or `version`) as layout JSON. */
export function savedLayoutJson(layout: Layout, version?: number): string | null {
  const chosen =
    version === undefined
      ? layout.versions[layout.versions.length - 1]
      : layout.versions.find((v) => v.version === version);
  if (!chosen) return null;
  return toJSON({
    snapshot: chosen.snapshot,
    theme: currentTheme(),
    meta: {
      id: fileIdFor(layout),
      name: layout.name,
      description: layout.description || getPageMeta(layout.page).description,
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

export type LoadOutcome =
  | { ok: true; result: ApplyResult; version: number }
  | { ok: false; error: string; issues: string[] };

/**
 * Load a saved layout (its latest version, or `version`) onto `page`: serialise it, parse and
 * validate it like an imported file, instantiate its widgets and apply their positions. The
 * store update runs inside startTransition. Note: React renders external-store (Zustand)
 * updates synchronously even in a transition, so this marks the work as non-urgent without
 * making the grid render interruptible.
 */
export function loadSavedLayout(layout: Layout, page: PageId, version?: number): LoadOutcome {
  const json = savedLayoutJson(layout, version);
  if (json === null) return { ok: false, error: 'That version no longer exists.', issues: [] };
  const parsed = fromJSON(json);
  if (!parsed.ok) return parsed;
  let result: ApplyResult = { applied: 0, dropped: 0, unknown: 0 };
  startTransition(() => {
    result = applySnapshot(page, toSnapshot(parsed.layout, page));
    useLayoutStore.getState().setActive(page, layout.id);
  });
  const loaded = version ?? layout.versions[layout.versions.length - 1]?.version ?? 1;
  return { ok: true, result, version: loaded };
}

/** The page's last valid layout JSON, if there is one. */
export function lastValidLayout(page: PageId): string | null {
  return useLayoutStore.getState().lastValidByPage[page] ?? null;
}

/** "Start fresh": the page's default layout (undoable, like Reset layout). */
export function startFresh(page: PageId): void {
  resetPage(page);
}
