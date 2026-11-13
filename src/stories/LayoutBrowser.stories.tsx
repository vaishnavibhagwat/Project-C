import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { useEffect, type ReactNode } from 'react';
import { LayoutBrowser } from '@/layout/LayoutBrowser';
import { LayoutThumbnail } from '@/layout/LayoutThumbnail';
import { SaveLayoutDialog } from '@/layout/SaveLayoutDialog';
import { defaultSnapshot, getPageMeta } from '@/registry/pages';
import { useLayoutStore } from '@/store/layoutStore';

const meta = {
  title: 'Layout/LayoutBrowser',
  component: LayoutBrowser,
  args: { page: getPageMeta('workstation') },
  decorators: [
    (Story) => (
      <SeedLayouts>
        <div className="w-[420px] bg-panel p-3">{Story()}</div>
      </SeedLayouts>
    ),
  ],
} satisfies Meta<typeof LayoutBrowser>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three saved layouts (two with descriptions, one with three versions). */
function SeedLayouts({ children }: { children: ReactNode }) {
  useEffect(() => {
    const s = useLayoutStore.getState();
    if (s.savedLayouts.some((l) => l.name === 'Morning desk')) return;
    const id = s.saveLayout(
      'Morning desk',
      defaultSnapshot('workstation'),
      '2026-11-10T09:10:00+05:30',
      'Opening view: NAV, allocation and risk above the holdings.',
    );
    s.saveVersion(id, defaultSnapshot('workstation'), 'Moved alerts', '2026-11-11T10:00:00+05:30');
    s.saveVersion(id, defaultSnapshot('workstation'), 'Wider table', '2026-11-12T15:20:00+05:30');
    s.saveLayout('Risk review', defaultSnapshot('risk'), '2026-11-11T14:05:00+05:30');
    s.saveLayout(
      'Holdings focus',
      defaultSnapshot('holdings'),
      '2026-11-12T11:45:00+05:30',
      'Big table with the treemap underneath.',
    );
    s.setActive('workstation', id);
  }, []);
  return children;
}

/** List view: thumbnail, name, description, created date, widget count, version. */
export const Default: Story = {};

/** Grid view over every page's layouts. */
export const Configured: Story = {
  args: { defaultView: 'grid' },
};

/** Mini preview of widget positions, coloured by widget category. */
export const Thumbnail: Story = {
  render: () => (
    <div className="flex gap-3">
      {(['workstation', 'risk', 'research'] as const).map((page) => (
        <LayoutThumbnail
          key={page}
          snapshot={defaultSnapshot(page)}
          className="h-24 w-32 rounded border border-line"
        />
      ))}
    </div>
  ),
};

/** Save dialog: name and description; with a layout loaded it also offers "Save as new". */
export const SaveDialog: Story = {
  render: () => <SaveLayoutDialog open onClose={fn()} page={getPageMeta('workstation')} />,
};
