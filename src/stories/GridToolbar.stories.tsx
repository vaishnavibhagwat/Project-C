import type { Decorator, Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { useEffect, type ReactNode } from 'react';
import { GridToolbar } from '@/grid/GridToolbar';
import { useDashboardStore } from '@/store/dashboardStore';
import type { Density } from '@/theme/tokens';

/** Put the workspace into a mode and density for the story, restoring edit mode afterwards. */
function withWorkspace(locked: boolean, density: Density = 'comfortable'): Decorator {
  function Workspace({ children }: { children: ReactNode }) {
    useEffect(() => {
      useDashboardStore.setState({ locked, density });
      return () => useDashboardStore.setState({ locked: false, density: 'comfortable' });
    }, []);
    return <>{children}</>;
  }
  const decorator: Decorator = (Story) => (
    <Workspace>
      <Story />
    </Workspace>
  );
  return decorator;
}

const meta = {
  title: 'Grid/GridToolbar',
  component: GridToolbar,
  args: { page: 'research', onOpenMarketplace: fn() },
} satisfies Meta<typeof GridToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Edit mode: Undo / Redo, Add widget, Marketplace, compaction, density, breakpoint. */
export const Default: Story = { decorators: [withWorkspace(false)] };

/** View mode, compact density: only Edit layout, density and the breakpoint remain. */
export const ViewMode: Story = { decorators: [withWorkspace(true, 'compact')] };
