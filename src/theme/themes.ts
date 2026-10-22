import { env } from '@/utils/env';
import type { Theme, ThemeTokenKey, ThemeTokens } from '@/types';

export const MIDNIGHT_GRAPHITE: Theme = {
  id: 'midnight-graphite',
  name: 'Midnight Graphite',
  mode: 'dark',
  builtIn: true,
  tokens: {
    bg: '#0b0e13',
    panel: '#111720',
    raised: '#18202c',
    border: '#1e2733',
    borderStrong: '#2c3747',
    text: '#e8edf5',
    textMuted: '#9aa8bc',
    textSubtle: '#7c8aa0',
    accent: '#22d3ee',
    accentContrast: '#04131a',
    positive: '#34d399',
    negative: '#ff6b6b',
    warning: '#fbbf24',
    focus: '#67e8f9',
    chart1: '#22d3ee',
    chart2: '#a78bfa',
    chart3: '#fbbf24',
    chart4: '#34d399',
    chart5: '#60a5fa',
    chart6: '#f472b6',
  },
};

export const PORCELAIN: Theme = {
  id: 'porcelain',
  name: 'Porcelain',
  mode: 'light',
  builtIn: true,
  tokens: {
    bg: '#f3f5f8',
    panel: '#ffffff',
    raised: '#eef2f6',
    border: '#e1e6ed',
    borderStrong: '#c7d0dc',
    text: '#0f172a',
    textMuted: '#475569',
    textSubtle: '#5f6b7d',
    accent: '#0e7490',
    accentContrast: '#ffffff',
    positive: '#047857',
    negative: '#c0262d',
    warning: '#a85a06',
    focus: '#0891b2',
    chart1: '#0e7490',
    chart2: '#7c3aed',
    chart3: '#b45309',
    chart4: '#047857',
    chart5: '#2563eb',
    chart6: '#db2777',
  },
};

export const HIGH_CONTRAST: Theme = {
  id: 'high-contrast',
  name: 'High Contrast',
  mode: 'dark',
  builtIn: true,
  tokens: {
    bg: '#000000',
    panel: '#0a0a0a',
    raised: '#171717',
    border: '#5c5c5c',
    borderStrong: '#8c8c8c',
    text: '#ffffff',
    textMuted: '#e0e0e0',
    textSubtle: '#c2c2c2',
    accent: '#00e5ff',
    accentContrast: '#000000',
    positive: '#3dff9a',
    negative: '#ff7a7a',
    warning: '#ffd23f',
    focus: '#ffff00',
    chart1: '#00e5ff',
    chart2: '#c792ea',
    chart3: '#ffd23f',
    chart4: '#3dff9a',
    chart5: '#82aaff',
    chart6: '#ff79c6',
  },
};

export const BUILT_IN_THEMES: readonly Theme[] = [MIDNIGHT_GRAPHITE, PORCELAIN, HIGH_CONTRAST];
/** Maps VITE_DEFAULT_THEME (`light`, `dark` or a built-in id) to a built-in theme id. */
export function themeIdForSetting(setting: string): string {
  if (setting === 'light') return PORCELAIN.id;
  if (setting === 'dark') return MIDNIGHT_GRAPHITE.id;
  return BUILT_IN_THEMES.some((t) => t.id === setting) ? setting : MIDNIGHT_GRAPHITE.id;
}

/** Theme for first-time visitors, from VITE_DEFAULT_THEME. */
export const DEFAULT_THEME_ID = themeIdForSetting(env.VITE_DEFAULT_THEME);

export function defaultTheme(): Theme {
  return BUILT_IN_THEMES.find((t) => t.id === DEFAULT_THEME_ID) ?? MIDNIGHT_GRAPHITE;
}

export const TOKEN_LABELS: Record<ThemeTokenKey, string> = {
  bg: 'Background',
  panel: 'Panel',
  raised: 'Raised surface',
  border: 'Border',
  borderStrong: 'Strong border',
  text: 'Primary text',
  textMuted: 'Secondary text',
  textSubtle: 'Tertiary text',
  accent: 'Accent',
  accentContrast: 'Text on accent',
  positive: 'Positive',
  negative: 'Negative',
  warning: 'Warning',
  focus: 'Focus ring',
  chart1: 'Series 1',
  chart2: 'Series 2',
  chart3: 'Series 3',
  chart4: 'Series 4',
  chart5: 'Series 5',
  chart6: 'Series 6',
};

/** CSS custom property name for a token, e.g. borderStrong -> --color-border-strong. */
export function tokenVar(key: ThemeTokenKey): string {
  const kebab = key.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();
  return `--color-${kebab}`;
}

/** Colour string usable in SVG attributes and inline styles; follows the active theme. */
export function cssColor(key: ThemeTokenKey, alpha?: number): string {
  return alpha === undefined
    ? `rgb(var(${tokenVar(key)}))`
    : `rgb(var(${tokenVar(key)}) / ${alpha})`;
}

export const CHART_SERIES: readonly ThemeTokenKey[] = [
  'chart1',
  'chart2',
  'chart3',
  'chart4',
  'chart5',
  'chart6',
];

export function seriesColor(index: number): string {
  return cssColor(CHART_SERIES[index % CHART_SERIES.length] ?? 'chart1');
}

export function cloneTokens(tokens: ThemeTokens): ThemeTokens {
  return { ...tokens };
}
