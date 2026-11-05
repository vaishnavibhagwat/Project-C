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
