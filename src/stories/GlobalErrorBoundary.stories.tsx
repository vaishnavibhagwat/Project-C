import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { GlobalErrorBoundary, GlobalErrorFallback } from '@/layout/GlobalErrorBoundary';

function BrokenShell(): never {
  throw new Error('Navigation failed to render');
}

function sampleError(): Error {
  const error = new TypeError('Cannot read properties of undefined (reading "layouts")');
  error.stack = `${error.name}: ${error.message}
    at PageToolbar (src/layout/PageToolbar.tsx:24:41)
    at AppShell (src/layout/AppShell.tsx:212:13)
    at RouterProvider (react-router-dom)`;
  return error;
}

const meta = {
  title: 'Layout/GlobalErrorBoundary',
  component: GlobalErrorFallback,
  parameters: { layout: 'fullscreen' },
  args: { error: sampleError(), onRetry: fn(), onReload: fn() },
} satisfies Meta<typeof GlobalErrorFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Full-page screen with Reload Dashboard; the stack trace is under Technical details. */
export const Default: Story = {};

/** An error without a stack trace: no Technical details section. */
export const Configured: Story = {
  args: { error: new Error('Provider failed to initialise') },
};

/** The boundary catching a shell that throws while rendering (stack trace logged). */
export const CaughtShellError: Story = {
  render: () => (
    <GlobalErrorBoundary>
      <BrokenShell />
    </GlobalErrorBoundary>
  ),
};
