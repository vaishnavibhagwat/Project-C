import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';
import ThemeBuilder from '@/theme/ThemeBuilder';
import { ThemeMenu } from '@/theme/ThemeMenu';

const meta = {
  title: 'Theme/ThemeMenu',
  component: ThemeMenu,
  render: () => (
    <div className="flex justify-end pb-80">
      <ThemeMenu />
    </div>
  ),
} satisfies Meta<typeof ThemeMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switch between Midnight Graphite, Porcelain and High Contrast; import or export JSON. */
export const Menu: Story = {};

function OpenBuilder() {
  useEffect(() => {
    useThemeStore.getState().openBuilder();
    return () => useThemeStore.getState().closeBuilder();
  }, []);
  return <ThemeBuilder />;
}

/** Token editor with live preview and computed WCAG contrast checks. */
export const Builder: Story = { render: () => <OpenBuilder /> };
