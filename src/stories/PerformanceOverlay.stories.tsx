import type { Meta, StoryObj } from '@storybook/react';
import PerformanceOverlay from '@/layout/PerformanceOverlay';

const meta = {
  title: 'Layout/PerformanceOverlay',
  component: PerformanceOverlay,
  args: { onClose: () => undefined },
} satisfies Meta<typeof PerformanceOverlay>;

export default meta;

/**
 * Live FPS, JS heap (Chrome), widgets, query subscriptions and per-widget renders. In the app
 * it opens with Ctrl+Shift+P; this story has no widgets, so render rows stay empty.
 */
export const Default: StoryObj<typeof meta> = {};
