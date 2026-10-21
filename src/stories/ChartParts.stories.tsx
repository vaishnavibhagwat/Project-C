import type { Meta, StoryObj } from '@storybook/react';
import { ChartTooltipBody, HoverCard } from '@/components/charts';
import { Delta } from '@/components/Delta';
import { cssColor } from '@/theme/themes';

function ChartPartsDemo() {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <ChartTooltipBody
        title="20 Oct 2026"
        rows={[
          { key: 'f', label: 'Fund', value: '123.45', color: cssColor('chart1') },
          { key: 'b', label: 'Nifty 50', value: '118.02', color: cssColor('textSubtle') },
          { key: 's', label: 'Spread', value: <Delta value={0.046} arrow={false} /> },
        ]}
      />
      <div className="relative h-40 w-72 rounded border border-line bg-panel">
        <HoverCard x={40} y={30} containerWidth={288} containerHeight={160}>
          <div className="font-medium text-fg">HDFCBANK · Financial Services</div>
          <div className="num text-pos">▲ +1.12%</div>
        </HoverCard>
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/ChartParts',
  component: ChartPartsDemo,
} satisfies Meta<typeof ChartPartsDemo>;

export default meta;

/** Crosshair tooltip body (Recharts widgets) and the positioned hover card (D3 widgets). */
export const TooltipAndHoverCard: StoryObj<typeof meta> = {};
