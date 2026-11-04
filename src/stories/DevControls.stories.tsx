import type { Decorator, Meta, StoryObj } from '@storybook/react';
import { useEffect, type ReactNode } from 'react';
import { setSimulatedOutage } from '@/data/connection';
import { resetDataControls, setLiveUpdatesPaused, setSimulatedFailure } from '@/data/controls';
import { DeveloperMenu, LiveUpdatesPausedBanner, LiveUpdatesToggle } from '@/layout/DevControls';

/** Turns on paused updates and simulated failure for a story; resets them on unmount. */
function withSimulation(): Decorator {
  function Setup({ children }: { children: ReactNode }) {
    useEffect(() => {
      setLiveUpdatesPaused(true);
      setSimulatedFailure(true);
      return () => {
        resetDataControls();
        setSimulatedOutage(false);
      };
    }, []);
    return <>{children}</>;
  }
  const decorator: Decorator = (Story) => (
    <Setup>
      <Story />
    </Setup>
  );
  return decorator;
}

function DevControlsBar() {
  return (
    <div className="flex flex-col gap-3">
      <LiveUpdatesPausedBanner />
      <div className="flex items-center gap-2">
        <LiveUpdatesToggle />
        <DeveloperMenu />
      </div>
    </div>
  );
}

const meta = {
  title: 'Layout/DevControls',
  component: DevControlsBar,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DevControlsBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Live: the Pause button and the developer menu (open it to see latency and failure switches). */
export const Default: Story = {};

/** Paused with simulated failure on: the paused banner, the amber toggle and menu dot. */
export const Configured: Story = { decorators: [withSimulation()] };
