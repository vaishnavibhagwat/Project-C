import type { Meta, StoryObj } from '@storybook/react';
import { AppErrorBoundary, AppErrorFallback } from '@/layout/AppErrorBoundary';

function BrokenShell(): never {
  throw new Error('Navigation failed to render');
}

const meta = {
  title: 'Layout/AppErrorBoundary',
  component: AppErrorFallback,
  parameters: { layout: 'fullscreen' },
  args: {
    error: new Error('Cannot read properties of undefined (reading "layouts")'),
    onRetry: () => undefined,
  },
} satisfies Meta<typeof AppErrorFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Full-page message for an error outside any widget. Saved state is not touched. */
export const Fallback: Story = {};

/** The boundary catching a shell that throws while rendering. */
export const CaughtShellError: Story = {
  render: () => (
    <AppErrorBoundary>
      <BrokenShell />
    </AppErrorBoundary>
  ),
};
