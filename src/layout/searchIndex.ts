import { NIFTY50 } from '@/data/nifty50';
import { PAGES } from '@/registry/pages';
import { widgetRegistry } from '@/registry/registry';
import type { AppRoute } from '@/types';

export type SearchResult =
  | { kind: 'page'; id: string; label: string; hint: string; route: AppRoute }
  | { kind: 'widget'; id: string; label: string; hint: string; type: string }
  | { kind: 'symbol'; id: string; label: string; hint: string; symbol: string }
  | { kind: 'action'; id: string; label: string; hint: string; action: CommandAction };

export type CommandAction =
  'toggle-lock' | 'open-layouts' | 'open-theme-builder' | 'toggle-outage' | 'share-layout';

const ACTIONS: { action: CommandAction; label: string; hint: string }[] = [
  { action: 'toggle-lock', label: 'Lock / unlock layout', hint: 'Layout' },
  { action: 'open-layouts', label: 'Save or load layouts', hint: 'Layout' },
  { action: 'share-layout', label: 'Share this page layout', hint: 'Layout' },
  { action: 'open-theme-builder', label: 'Customise theme', hint: 'Theme' },
  { action: 'toggle-outage', label: 'Toggle simulated feed outage', hint: 'Data feed' },
];

function score(label: string, hint: string, q: string): number {
  const l = label.toLowerCase();
  if (l === q) return 100;
  if (l.startsWith(q)) return 80;
  if (l.includes(q)) return 60;
  if (hint.toLowerCase().includes(q)) return 30;
  return 0;
}

/** Search pages, widgets, Nifty 50 symbols and commands. Pure; tested directly. */
export function search(query: string, limit = 12): SearchResult[] {
  const q = query.trim().toLowerCase();
  const all: SearchResult[] = [
    ...PAGES.map((p) => ({
      kind: 'page' as const,
      id: `page-${p.id}`,
      label: p.title,
      hint: 'Go to page',
      route: p.id,
    })),
    {
      kind: 'page',
      id: 'page-marketplace',
      label: 'Widget Marketplace',
      hint: 'Go to page',
      route: 'marketplace',
    },
    {
      kind: 'page',
      id: 'page-settings',
      label: 'Settings',
      hint: 'Grid, theme, data feed, shortcuts',
      route: 'settings',
    },
    ...widgetRegistry.getAllWidgets().map((w) => ({
      kind: 'widget' as const,
      id: `widget-${w.id}`,
      label: w.name,
      hint: `Add widget · ${w.category}`,
      type: w.id,
    })),
    ...NIFTY50.map((c) => ({
      kind: 'symbol' as const,
      id: `symbol-${c.symbol}`,
      label: c.symbol,
      hint: `${c.name} · ${c.sector}`,
      symbol: c.symbol,
    })),
    ...ACTIONS.map((a) => ({
      kind: 'action' as const,
      id: `action-${a.action}`,
      label: a.label,
      hint: a.hint,
      action: a.action,
    })),
  ];
  if (q === '') return all.filter((r) => r.kind === 'page' || r.kind === 'action').slice(0, limit);
  return all
    .map((r) => ({ r, s: score(r.label, r.hint, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.r);
}
