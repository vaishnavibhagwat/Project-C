import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { fixture } from '@/__tests__/fixtures';
import { WidgetChunkLoadError } from '@/registry/defineWidget';
import { WidgetErrorBoundary, WidgetErrorFallback } from '@/registry/WidgetErrorBoundary';
import { UnknownWidgetPlaceholder, WidgetRenderer } from '@/registry/WidgetRenderer';
import { WidgetCanvas } from './helpers';

function Crash(): never {
  throw new Error('chart received an unexpected shape');
}

const meta = {
  title: 'Registry/WidgetRenderer',
  component: WidgetRenderer,
  args: {
    instance: {
      instanceId: 'story-var-gauge',
      widgetId: 'var-gauge',
      config: {},
      position: { x: 0, y: 0, w: 3, h: 5 },
    },
    data: fixture('risk/var'),
    width: 360,
    height: 380,
    onConfigChange: fn(),
  },
  render: (args) => (
    <WidgetCanvas width={args.width ?? 360} height={args.height ?? 380}>
      <WidgetRenderer {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof WidgetRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A registered widget (Value at Risk), loaded lazily with a skeleton meanwhile. */
export const Default: Story = {};

/** The same widget with saved settings and a custom title. */
export const Configured: Story = {
  args: {
    instance: {
      instanceId: 'story-var-gauge-95',
      widgetId: 'var-gauge',
      config: { confidence: '95' },
      position: { x: 0, y: 0, w: 3, h: 5 },
      title: 'Desk VaR (95%)',
    },
  },
};

/** An instance whose type is not in the registry. */
export const UnknownType: Story = {
  render: () => (
    <WidgetCanvas width={360} height={220}>
      <UnknownWidgetPlaceholder widgetId="retired-widget" />
    </WidgetCanvas>
  ),
};

/** A widget that throws while rendering: name, message and Retry (remounts it). */
export const RenderError: Story = {
  render: () => (
    <WidgetCanvas width={360} height={220}>
      <WidgetErrorBoundary name="NAV vs Nifty 50">{() => <Crash />}</WidgetErrorBoundary>
    </WidgetCanvas>
  ),
};

/** A widget whose code chunk failed to load. */
export const ChunkLoadFailure: Story = {
  render: () => (
    <WidgetCanvas width={360} height={220}>
      <WidgetErrorFallback
        name="Sector Returns Heat Map"
        error={
          new WidgetChunkLoadError(
            'sector-heatmap',
            new TypeError('Failed to fetch dynamically imported module'),
          )
        }
        onRetry={fn()}
      />
    </WidgetCanvas>
  ),
};
