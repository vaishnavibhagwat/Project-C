import type { Config } from 'tailwindcss';
import { RADIUS_VARS, spacingScale } from './src/theme/tokens';

/** Every colour resolves to a CSS custom property so themes swap without re-rendering CSS. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', './.storybook/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme-mode="dark"]'],
  theme: {
    // Structural scales point at the CSS custom properties in src/theme/global.css.
    spacing: spacingScale(),
    borderRadius: {
      none: '0px',
      sm: `var(${RADIUS_VARS.sm})`,
      DEFAULT: `var(${RADIUS_VARS.DEFAULT})`,
      md: `var(${RADIUS_VARS.md})`,
      full: `var(${RADIUS_VARS.full})`,
    },
    extend: {
      borderWidth: { DEFAULT: 'var(--divider)' },
      colors: {
        bg: token('color-bg'),
        panel: token('color-panel'),
        raised: token('color-raised'),
        line: token('color-border'),
        'line-strong': token('color-border-strong'),
        fg: token('color-text'),
        muted: token('color-text-muted'),
        subtle: token('color-text-subtle'),
        accent: token('color-accent'),
        'accent-fg': token('color-accent-contrast'),
        pos: token('color-positive'),
        neg: token('color-negative'),
        warn: token('color-warning'),
        focus: token('color-focus'),
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
