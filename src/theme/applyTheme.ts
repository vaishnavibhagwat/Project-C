import { THEME_TOKEN_KEYS, type Theme } from '@/types';
import { hexToChannels } from '@/utils/color';
import { tokenVar } from './themes';

/** localStorage key read by the pre-paint script in index.html to avoid a theme flash. */
export const THEME_CACHE_KEY = 'meridian:theme-vars';

export function themeToCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of THEME_TOKEN_KEYS) vars[tokenVar(key)] = hexToChannels(theme.tokens[key]);
  return vars;
}

/**
 * Apply a theme by writing CSS custom properties on <html>. No React tree re-renders are
 * needed: Tailwind classes and SVG fills reference the variables directly.
 */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  const vars = themeToCssVars(theme);
  // Suspend colour transitions for this frame: the switch is instant (no fade or flash) and
  // the browser does not start hundreds of transitions at once.
  root.classList.add('theme-switching');
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => root.classList.remove('theme-switching')),
    );
  } else {
    root.classList.remove('theme-switching');
  }
  root.dataset.themeMode = theme.mode;
  root.dataset.theme = theme.id;
  root.style.colorScheme = theme.mode;
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify({ mode: theme.mode, vars }));
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this session.
  }
}
