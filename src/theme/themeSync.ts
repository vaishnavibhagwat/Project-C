import { selectPaintedTheme, useThemeStore } from '@/store/themeStore';
import type { ThemeDefinition } from '@/types';
import { applyTheme } from './applyTheme';

/**
 * Paint the active theme and keep it in sync with ThemeStore. Runs outside React, so a theme
 * switch is a handful of CSS variable writes with no component re-render. Returns cleanup.
 */
export function startThemeSync(): () => void {
  let painted: ThemeDefinition = selectPaintedTheme(useThemeStore.getState());
  applyTheme(painted);
  return useThemeStore.subscribe((state) => {
    const next = selectPaintedTheme(state);
    if (next !== painted) {
      painted = next;
      applyTheme(next);
    }
  });
}
