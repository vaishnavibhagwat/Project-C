export const THEME_TOKEN_KEYS = [
  'bg',
  'panel',
  'raised',
  'border',
  'borderStrong',
  'text',
  'textMuted',
  'textSubtle',
  'accent',
  'accentContrast',
  'positive',
  'negative',
  'warning',
  'focus',
  'chart1',
  'chart2',
  'chart3',
  'chart4',
  'chart5',
  'chart6',
] as const;

export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];

/** Hex colour values (#RRGGBB) for every design token. */
export type ThemeTokens = Record<ThemeTokenKey, string>;

export interface ThemeDefinition {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  tokens: ThemeTokens;
  builtIn: boolean;
}
