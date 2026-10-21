import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/Button';
import { Popover } from '@/components/Popover';

function PopoverDemo() {
  return (
    <div className="flex justify-center pb-40">
      <Popover
        label="Example menu"
        align="start"
        trigger={(p) => <Button {...p}>Open menu</Button>}
      >
        {(close) => (
          <div className="flex flex-col p-2 text-sm">
            <button
              type="button"
              className="rounded px-2 py-1.5 text-left hover:bg-raised"
              onClick={close}
            >
              First action
            </button>
            <button
              type="button"
              className="rounded px-2 py-1.5 text-left hover:bg-raised"
              onClick={close}
            >
              Second action
            </button>
          </div>
        )}
      </Popover>
    </div>
  );
}

const meta = { title: 'Components/Popover', component: PopoverDemo } satisfies Meta<
  typeof PopoverDemo
>;

export default meta;

/** Anchored panel; closes on outside click and Escape. */
export const Default: StoryObj<typeof meta> = {};
