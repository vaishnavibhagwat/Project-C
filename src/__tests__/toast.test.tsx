import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionConfig } from 'framer-motion';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '@/components/MotionProvider';
import { TOAST_DURATION_MS, ToastProvider, useToast, type ToastOptions } from '@/components/Toast';

function Fire({ toast }: { toast: ToastOptions }) {
  const notify = useToast();
  return (
    <button type="button" onClick={() => notify(toast)}>
      Fire
    </button>
  );
}

const setup = (toast: ToastOptions) =>
  render(
    <MotionProvider>
      <MotionConfig reducedMotion="always">
        <ToastProvider>
          <Fire toast={toast} />
        </ToastProvider>
      </MotionConfig>
    </MotionProvider>,
  );

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it.each([
    ['info', 'Info'],
    ['success', 'Success'],
    ['warning', 'Warning'],
    ['error', 'Error'],
  ] as const)('%s toasts carry an icon and a spoken label, not only colour', (tone, label) => {
    setup({ message: 'Saved layout', tone });
    fireEvent.click(screen.getByRole('button', { name: 'Fire' }));
    const region = screen.getByTestId(tone === 'error' ? 'toasts-assertive' : 'toasts-polite');
    expect(region).toHaveAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
    expect(region).toHaveTextContent(`${label}: Saved layout`);
    expect(region.querySelector('svg')).not.toBeNull();
  });

  it('closes after 5 seconds, but not while hovered', () => {
    vi.useFakeTimers();
    setup({ message: 'Widget removed' });
    fireEvent.click(screen.getByRole('button', { name: 'Fire' }));
    const toast = screen.getByText('Widget removed').closest('[data-tone]');
    if (!(toast instanceof HTMLElement)) throw new Error('no toast');
    fireEvent.mouseEnter(toast);
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS * 2);
    });
    expect(screen.getByText('Widget removed')).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS + 50);
    });
    expect(screen.queryByText('Widget removed')).not.toBeInTheDocument();
  });

  it('runs its action and closes', () => {
    const onClick = vi.fn();
    setup({ message: 'Removed “VaR”', action: { label: 'Undo', onClick } });
    fireEvent.click(screen.getByRole('button', { name: 'Fire' }));
    const region = screen.getByTestId('toasts-polite');
    fireEvent.click(within(region).getByRole('button', { name: 'Undo' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Removed “VaR”')).not.toBeInTheDocument();
  });
});
