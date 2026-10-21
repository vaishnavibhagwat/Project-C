import '@fontsource-variable/inter';
import '../src/theme/global.css';
import type { Decorator, Preview } from '@storybook/react';
import { useEffect, type ReactNode } from 'react';
import { useThemeStore } from '../src/store/themeStore';
import { BUILT_IN_THEMES } from '../src/theme/themes';
import { applyTheme } from '../src/theme/applyTheme';
import { StoryProviders } from '../src/stories/StoryProviders';

/** Applies the theme picked in the toolbar using the same CSS-variable path as the app. */
function ThemeApplier({ themeId, children }: { themeId: string; children: ReactNode }) {
  useEffect(() => {
    const theme = BUILT_IN_THEMES.find((t) => t.id === themeId) ?? BUILT_IN_THEMES[0];
    if (theme) {
      useThemeStore.getState().setActiveTheme(theme.id);
      applyTheme(theme);
    }
  }, [themeId]);
  return children;
}

const withTheme: Decorator = (Story, context) => {
  const themeId =
    typeof context.globals.theme === 'string' ? context.globals.theme : 'midnight-graphite';
  return (
    <ThemeApplier themeId={themeId}>
      <Story />
    </ThemeApplier>
  );
};

const withProviders: Decorator = (Story) => (
  <StoryProviders>
    <Story />
  </StoryProviders>
);

const preview: Preview = {
  decorators: [withProviders, withTheme],
  globalTypes: {
    theme: {
      description: 'Design theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: BUILT_IN_THEMES.map((t) => ({ value: t.id, title: t.name })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'midnight-graphite' },
  parameters: {
    layout: 'padded',
    backgrounds: { disable: true },
    controls: { matchers: { color: /(background|color)$/i } },
  },
};

export default preview;
