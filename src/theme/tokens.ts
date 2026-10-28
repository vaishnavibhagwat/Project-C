/**
 * Structural design tokens: spacing, radii, dividers and type. Their values live as CSS custom
 * properties in global.css (`:root`); Tailwind maps its scales to these variables, so changing
 * a token changes every utility that uses it. Colours are per theme (see themes.ts).
 *
 * This file is imported by tailwind.config.ts, so it must not import app code.
 */

/** One spacing step: 4 px at the default root font size (kept in rem so it follows zoom). */
export const SPACE_UNIT_VAR = '--space-unit';

/** Tailwind spacing keys; key n means n × 4 px (0.5 = 2 px). The same keys as Tailwind's default. */
export const SPACING_STEPS = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44,
  48, 52, 56, 60, 64, 72, 80, 96,
] as const;

/** Tailwind `spacing` scale: every step is a multiple of the spacing unit. */
export function spacingScale(): Record<string, string> {
  const scale: Record<string, string> = { px: 'var(--divider)' };
  for (const step of SPACING_STEPS) {
    scale[String(step)] = step === 0 ? '0px' : `calc(var(${SPACE_UNIT_VAR}) * ${step})`;
  }
  return scale;
}

/** Small radii only: the interface is dense, with no large rounded cards. */
export const RADIUS_VARS = {
  sm: '--radius-sm',
  DEFAULT: '--radius',
  md: '--radius-md',
  full: '--radius-full',
} as const;

/** Every structural custom property global.css must define (checked by a test). */
export const STRUCTURAL_VARS = [
  SPACE_UNIT_VAR,
  '--radius-sm',
  '--radius',
  '--radius-md',
  '--radius-full',
  '--divider',
  '--font-sans',
  '--font-mono',
  '--font-scale',
] as const;

/** Multiplies every Tailwind font size; set per density on `:root[data-density]`. */
export const FONT_SCALE_VAR = '--font-scale';

/** Type scale in rem at density 1: [size, line height]. */
const FONT_SIZES = {
  '2xs': [0.6875, 1],
  xs: [0.75, 1.125],
  sm: [0.8125, 1.25],
  base: [0.875, 1.375],
  lg: [1, 1.5],
  xl: [1.25, 1.75],
} as const;

/** Tailwind `fontSize` scale: every size and line height follows the font-scale token. */
export function fontSizeScale(): Record<string, [string, { lineHeight: string }]> {
  const scale: Record<string, [string, { lineHeight: string }]> = {};
  for (const [key, [size, line]] of Object.entries(FONT_SIZES)) {
    scale[key] = [
      `calc(${size}rem * var(${FONT_SCALE_VAR}))`,
      { lineHeight: `calc(${line}rem * var(${FONT_SCALE_VAR}))` },
    ];
  }
  return scale;
}

export type Density = 'comfortable' | 'compact';

/**
 * Density tokens. Grid row height and gap are multiples of the user's grid settings (so a
 * density switch never rewrites stored layouts); fontScale is written to --font-scale by the
 * `:root[data-density]` rules in global.css (kept equal to these values by a test).
 */
export const DENSITY_TOKENS: Record<
  Density,
  { rowScale: number; gapScale: number; fontScale: number }
> = {
  comfortable: { rowScale: 1, gapScale: 1, fontScale: 1 },
  compact: { rowScale: 0.8, gapScale: 0.75, fontScale: 0.9375 },
};
