import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useThemeStore } from '@/store/themeStore';
import { applyTheme, THEME_CACHE_KEY, themeToCssVars } from '@/theme/applyTheme';
import ThemeBuilder, { runContrastChecks } from '@/theme/ThemeBuilder';
import { ThemeMenu } from '@/theme/ThemeMenu';
import { BUILT_IN_THEMES, cssColor, HIGH_CONTRAST, PORCELAIN, tokenVar } from '@/theme/themes';
import { startThemeSync } from '@/theme/themeSync';
import { renderWithProviders } from './render';

const initial = useThemeStore.getState();

beforeEach(() => {
  useThemeStore.setState(initial, true);
});

describe('design tokens', () => {
  it('maps token keys to CSS custom properties', () => {
    expect(tokenVar('borderStrong')).toBe('--color-border-strong');
    expect(tokenVar('chart1')).toBe('--color-chart-1');
    expect(cssColor('accent', 0.5)).toBe('rgb(var(--color-accent) / 0.5)');
  });

  it.each(BUILT_IN_THEMES.map((t) => [t.name, t] as const))(
    '%s meets its computed WCAG contrast targets',
    (_, theme) => {
      const failing = runContrastChecks(theme.tokens).filter((c) => !c.pass);
      expect(failing.map((c) => `${c.label} ${c.ratio.toFixed(2)}`)).toEqual([]);
    },
  );
});

describe('applyTheme', () => {
  it('writes channel variables, mode and a pre-paint cache', () => {
    applyTheme(PORCELAIN);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-bg')).toBe('243 245 248');
    expect(root.dataset.themeMode).toBe('light');
    const cached: unknown = JSON.parse(localStorage.getItem(THEME_CACHE_KEY) ?? 'null');
    expect(cached).toMatchObject({ mode: 'light', vars: themeToCssVars(PORCELAIN) });
  });

  it('repaints when the active theme changes, without React', () => {
    const stop = startThemeSync();
    act(() => useThemeStore.getState().setActiveTheme(HIGH_CONTRAST.id));
    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe('0 0 0');
    stop();
    act(() => useThemeStore.getState().setActiveTheme(PORCELAIN.id));
    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe('0 0 0');
  });
});

describe('ThemeMenu', () => {
  it('switches themes from the command bar', () => {
    renderWithProviders(<ThemeMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
    fireEvent.click(screen.getByRole('button', { name: /Porcelain/ }));
    expect(useThemeStore.getState().activeThemeId).toBe('porcelain');
    expect(screen.getByRole('option', { name: /Porcelain/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('opens the builder', () => {
    renderWithProviders(<ThemeMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
    fireEvent.click(screen.getByRole('button', { name: /Customise current theme/ }));
    expect(useThemeStore.getState().builder.open).toBe(true);
  });
});

describe('ThemeBuilder', () => {
  it('edits a token, shows contrast results and saves a custom theme', () => {
    act(() => useThemeStore.getState().openBuilder());
    renderWithProviders(<ThemeBuilder />);
    expect(screen.getByRole('dialog', { name: 'Theme builder' })).toBeInTheDocument();
    expect(screen.getByText(/all pass/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Secondary text/ }));
    fireEvent.change(screen.getByLabelText('Hex value'), { target: { value: '1a1f27' } });
    expect(useThemeStore.getState().builder.draft?.tokens.textMuted).toBe('#1a1f27');
    expect(screen.getByText(/below target/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save theme' }));
    const state = useThemeStore.getState();
    expect(state.builder.open).toBe(false);
    expect(state.customThemes).toHaveLength(1);
    expect(state.activeThemeId).toBe(state.customThemes[0]?.id);
  });
});
