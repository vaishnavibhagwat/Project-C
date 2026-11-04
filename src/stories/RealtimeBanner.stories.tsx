import type { Decorator, Meta, StoryObj } from '@storybook/react';
import { useEffect, type ReactNode } from 'react';
import { setSimulatedOutage } from '@/data/connection';
import { portfolioPricesUrl, wsSimulator } from '@/data/wsSimulator';
import { RealtimeBanner } from '@/layout/RealtimeBanner';

/**
 * Drops the simulated socket for the story: `simulated` takes the server away until the story
 * unmounts; `network` turns on the global feed outage. A no-op subscription keeps the
 * reconnect attempts (and the countdown) running.
 */
function withDisconnect(kind: 'simulated' | 'network'): Decorator {
  function Setup({ children }: { children: ReactNode }) {
    useEffect(() => {
      const off = wsSimulator.subscribe(portfolioPricesUrl('MER-IMAF-01'), () => undefined, {
        intervalMs: 10_000,
      });
      if (kind === 'simulated') wsSimulator.simulateDisconnect(Number.POSITIVE_INFINITY);
      else setSimulatedOutage(true);
      return () => {
        setSimulatedOutage(false);
        wsSimulator.restore();
        off();
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

const meta = {
  title: 'Layout/RealtimeBanner',
  component: RealtimeBanner,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof RealtimeBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Socket server unreachable: polling fallback, countdown to the next attempt, Retry now. */
export const Default: Story = { decorators: [withDisconnect('simulated')] };

/** The whole data feed is offline (outage switch), so the socket cannot reconnect either. */
export const Configured: Story = { decorators: [withDisconnect('network')] };
