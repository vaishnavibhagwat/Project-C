import { THEME_TOKEN_KEYS, type ThemeDefinition } from '@/types';
import { hexToChannels } from '@/utils/color';
import { tokenVar } from './themes';

/** localStorage key read by the pre-paint script in index.html to avoid a theme flash. */
export const THEME_CACHE_KEY = 'meridian:theme-vars';

export function themeToCssVars(theme: ThemeDefinition): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of THEME_TOKEN_KEYS) vars[tokenVar(key)] = hexToChannels(theme.tokens[key]);
  return vars;
}

/**
 * Apply a theme by writing CSS custom properties on <html>. No React tree re-renders are
 * needed: Tailwind classes and SVG fills reference the variables directly.
 */
export function applyTheme(
  theme: ThemeDefinition,
  root: HTMLElement = document.documentElement,
): void {
  const vars = themeToCssVars(theme);
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  root.dataset.themeMode = theme.mode;
  root.dataset.theme = theme.id;
  root.style.colorScheme = theme.mode;
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify({ mode: theme.mode, vars }));
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this session.
  }
}
