import type { Meta, StoryObj } from '@storybook/react';
import { Button, IconButton } from '@/components/Button';
import { IconRefresh, IconSettings } from '@/components/Icons';
import { Tooltip } from '@/components/Tooltip';

function TooltipDemo() {
  return (
    <div className="flex items-center gap-6 p-16">
      <Tooltip content="Refetches this widget's data now">
        {(tip) => (
          <Button {...tip} icon={IconRefresh}>
            Refresh
          </Button>
        )}
      </Tooltip>
      <Tooltip content="Opens on the right" side="right">
        {(tip) => <Button {...tip}>Right</Button>}
      </Tooltip>
      <IconButton label="Configure widget" icon={IconSettings} />
    </div>
  );
}

const meta = {
  title: 'Components/Tooltip',
  component: TooltipDemo,
} satisfies Meta<typeof TooltipDemo>;

export default meta;

/** Hover (350 ms delay) or Tab to a control. Escape closes. The icon button's tooltip is decorative. */
export const Default: StoryObj<typeof meta> = {};
