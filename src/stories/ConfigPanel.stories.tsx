import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import { ConfigPanel } from '@/grid/ConfigPanel';
import { useWidgetStore } from '@/store/widgetStore';

function OpenConfigPanel({ instanceId }: { instanceId: string }) {
  useEffect(() => {
    useWidgetStore.getState().openSettings(instanceId);
    return () => useWidgetStore.getState().closeSettings();
  }, [instanceId]);
  return <ConfigPanel />;
}

const meta = {
  title: 'Grid/ConfigPanel',
  component: OpenConfigPanel,
  args: { instanceId: 'workstation-var-gauge' },
} satisfies Meta<typeof OpenConfigPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Settings drawer generated from the widget's JSON Schema; Save is blocked while invalid. */
export const ValueAtRisk: Story = {};
export const HoldingsTable: Story = { args: { instanceId: 'workstation-holdings-table' } };
