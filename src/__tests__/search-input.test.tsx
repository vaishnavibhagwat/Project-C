import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEARCH_DEBOUNCE_MS, SearchInput } from '@/components/SearchInput';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const box = () => screen.getByRole('searchbox', { name: 'Search widgets' });
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });

describe('SearchInput', () => {
  it('calls onSearch once, 300 ms after typing stops', () => {
    const onSearch = vi.fn();
    render(<SearchInput label="Search widgets" onSearch={onSearch} />);
    expect(SEARCH_DEBOUNCE_MS).toBe(300);

    type('n');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    type('na');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    type('nav');
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('nav');
  });

  it('does not search on mount or when the text comes back to the last search', () => {
    const onSearch = vi.fn();
    render(<SearchInput label="Search widgets" value="risk" onSearch={onSearch} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    type('risky');
    type('risk');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('clears at once with the clear button and returns focus to the box', () => {
    const onSearch = vi.fn();
    render(<SearchInput label="Search widgets" onSearch={onSearch} />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();

    type('var');
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onSearch).toHaveBeenLastCalledWith('');
    expect(box()).toHaveValue('');
    expect(box()).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('Escape clears without reaching an enclosing dialog; Enter searches immediately', () => {
    const onSearch = vi.fn();
    const onOuterKey = vi.fn();
    render(
      <div onKeyDown={onOuterKey}>
        <SearchInput label="Search widgets" onSearch={onSearch} />
      </div>,
    );
    type('heat');
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledWith('heat');

    fireEvent.keyDown(box(), { key: 'Escape' });
    expect(box()).toHaveValue('');
    expect(onSearch).toHaveBeenLastCalledWith('');
    expect(onOuterKey).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }));

    // With nothing to clear, Escape is left to the surroundings (closing a dialog).
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect(onOuterKey).toHaveBeenCalledTimes(2);
  });

  it('follows a value reset from outside', () => {
    function Harness() {
      const [query, setQuery] = useState('');
      return (
        <>
          <SearchInput label="Search widgets" value={query} onSearch={setQuery} />
          <button type="button" onClick={() => setQuery('')}>
            Reset
          </button>
          <output>{query}</output>
        </>
      );
    }
    render(<Harness />);
    type('gauge');
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(screen.getByRole('status')).toHaveTextContent('gauge');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(box()).toHaveValue('');
  });
});
