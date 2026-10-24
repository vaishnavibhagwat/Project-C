import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Drawer, Modal } from '@/components/Overlay';

function OverlayDemo({ kind }: { kind: 'modal' | 'drawer' }) {
  const [open, setOpen] = useState(true);
  const Panel = kind === 'modal' ? Modal : Drawer;
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open {kind}</Button>
      <Panel
        open={open}
        onClose={() => setOpen(false)}
        title={kind === 'modal' ? 'Reset Workstation?' : 'Configure · Value at Risk'}
        description="Focus is trapped inside; Escape or the close button dismisses."
        actions={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Dialog body content.</p>
      </Panel>
    </>
  );
}

const meta = {
  title: 'Components/Overlay',
  component: OverlayDemo,
  args: { kind: 'modal' },
} satisfies Meta<typeof OverlayDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Modal: centred, focus-trapped dialog. */
export const ModalDialog: Story = {};
/** Drawer: side panel used for configuration, layouts and the theme builder. */
export const DrawerPanel: Story = { args: { kind: 'drawer' } };
