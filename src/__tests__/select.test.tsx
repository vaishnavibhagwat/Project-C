import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SentimentBadge } from '@/components/Badge';
import { Select } from '@/components/Select';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
] as const;

describe('Select', () => {
  it('shows the current value and picks another option from the menu', () => {
    const onValueChange = vi.fn();
    render(<Select label="Letter" value="a" options={OPTIONS} onValueChange={onValueChange} />);
    const trigger = screen.getByRole('button', { name: 'Letter: Alpha' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.click(trigger);
    expect(screen.getByRole('menuitemradio', { name: 'Alpha' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Bravo' }));
    expect(onValueChange).toHaveBeenCalledWith('b');
  });
});

describe('SentimentBadge', () => {
  it('pairs each sentiment colour with a mark and a text label', () => {
    render(
      <>
        <SentimentBadge sentiment="positive" />
        <SentimentBadge sentiment="negative" />
        <SentimentBadge sentiment="neutral" score={0.05} />
      </>,
    );
    expect(screen.getByText('Positive').className).toContain('text-pos');
    expect(screen.getByText('Negative').className).toContain('text-neg');
    expect(screen.getByText('Neutral').className).toContain('text-muted');
    expect(screen.getByTitle('Sentiment score 0.05 (−1 to +1)')).toBeInTheDocument();
    expect(screen.getAllByText(/^[▲▼■]$/)).toHaveLength(3);
  });
});

describe('Dropdown on scroll', () => {
  it('stays open while its trigger is in view, and closes once it scrolls away', () => {
    render(
      <div data-testid="scroller">
        <Select label="Letter" value="a" options={OPTIONS} onValueChange={() => undefined} />
      </div>,
    );
    const trigger = screen.getByRole('button', { name: 'Letter: Alpha' });
    fireEvent.click(trigger);
    fireEvent.scroll(screen.getByTestId('scroller'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    const away = {
      top: 5000,
      bottom: 5020,
      left: 0,
      right: 80,
      width: 80,
      height: 20,
      x: 0,
      y: 5000,
    };
    trigger.getBoundingClientRect = () => ({ ...away, toJSON: () => away });
    fireEvent.scroll(screen.getByTestId('scroller'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
