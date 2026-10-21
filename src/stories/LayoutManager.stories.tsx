import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { useEffect, type ReactNode } from 'react';
import { getPageMeta } from '@/registry/pages';
import { LayoutManager } from '@/layout/LayoutManager';
import { ShareDialog } from '@/layout/ShareDialog';
import { SharedLayoutBanner } from '@/layout/SharedLayoutBanner';
import { captureSnapshot } from '@/store/actions';
import { useLayoutStore } from '@/store/layoutStore';
import { encodeShare } from '@/store/share';

const meta = {
  title: 'Layout/LayoutManager',
  component: LayoutManager,
  args: { open: true, onClose: fn(), page: getPageMeta('workstation') },
} satisfies Meta<typeof LayoutManager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

function WithSavedLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const s = useLayoutStore.getState();
    if (!s.saved.some((l) => l.name === 'Morning desk')) {
      const id = s.saveNew(
        'Morning desk',
        captureSnapshot('workstation'),
        '2026-10-20T09:10:00+05:30',
      );
      s.saveVersion(
        id,
        captureSnapshot('workstation'),
        'Added VaR gauge',
        '2026-10-20T11:30:00+05:30',
      );
    }
  }, []);
  return children;
}

/** A saved layout with two versions; open the history icon to restore one. */
export const WithVersions: Story = {
  decorators: [(Story) => <WithSavedLayout>{Story()}</WithSavedLayout>],
};

export const Share: Story = {
  render: () => <ShareDialog open onClose={fn()} page={getPageMeta('risk')} />,
};

/** Banner shown when a shared link is opened (valid and corrupted). */
export const SharedLinkBanner: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <SharedLayoutBanner
        encoded={encodeShare(captureSnapshot('risk'))}
        page="workstation"
        onDone={fn()}
      />
      <SharedLayoutBanner encoded="corrupted-link" page="workstation" onDone={fn()} />
    </div>
  ),
};
