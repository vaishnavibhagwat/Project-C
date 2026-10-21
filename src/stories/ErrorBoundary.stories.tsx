import type { Meta, StoryObj } from '@storybook/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState } from '@/components/StateViews';
import { WidgetCanvas } from './helpers';

function Broken(): never {
  throw new Error('Chart received an unexpected shape');
}

function ErrorBoundaryDemo() {
  return (
    <WidgetCanvas width={360} height={200}>
      <ErrorBoundary
        fallback={(e, reset) => (
          <ErrorState message={`This widget failed to render: ${e.message}`} onRetry={reset} />
        )}
      >
        <Broken />
      </ErrorBoundary>
    </WidgetCanvas>
  );
}

const meta = {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundaryDemo,
} satisfies Meta<typeof ErrorBoundaryDemo>;

export default meta;

/** A render error inside one widget is contained and shown with a Retry action. */
export const CaughtRenderError: StoryObj<typeof meta> = {};
