import type { Decorator, Meta, StoryObj } from '@storybook/react';
import { useEffect, type ReactNode } from 'react';
import { WidgetCatalogue } from '@/grid/WidgetCatalogue';
import { addPlaceholder, MAX_WIDGETS_PER_PAGE } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';

/** Opens (or collapses) the catalogue for the story and, optionally, fills the page. */
function withCatalogue(open: boolean, fill = false): Decorator {
  function Setup({ children }: { children: ReactNode }) {
    useEffect(() => {
      const before = useDashboardStore.getState();
      useDashboardStore.setState({ catalogueOpen: open });
      if (fill) {
        while (useDashboardStore.getState().pages.research.itemIds.length < MAX_WIDGETS_PER_PAGE) {
          if (!addPlaceholder('research')) break;
        }
      }
      return () =>
        useDashboardStore.setState({ catalogueOpen: before.catalogueOpen, pages: before.pages });
    }, []);
    return <div className="flex h-[640px] justify-end">{children}</div>;
  }
  const decorator: Decorator = (Story) => (
    <Setup>
      <Story />
    </Setup>
  );
  return decorator;
}

const meta = {
  title: 'Grid/WidgetCatalogue',
  component: WidgetCatalogue,
  args: { page: 'research' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof WidgetCatalogue>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open: every widget by category, search, click to add, drag onto a grid. */
export const Default: Story = { decorators: [withCatalogue(true)] };

/** The page is at VITE_MAX_WIDGETS: items are disabled and a notice explains why. */
export const Configured: Story = { decorators: [withCatalogue(true, true)] };

/** Collapsed to its expand button. */
export const Collapsed: Story = { decorators: [withCatalogue(false)] };
