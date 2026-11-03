import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cx } from '@/utils/cx';
import { IconClose, IconSearch } from './Icons';

/** Default wait after the last keystroke before the search runs. */
export const SEARCH_DEBOUNCE_MS = 300;

export interface SearchInputProps {
  /** Accessible name (visually hidden). */
  label: string;
  /**
   * The search the parent is showing. Optional: when it changes from outside (a reset), the
   * text box follows it. Typing does not need to update it.
   */
  value?: string;
  /** Called with the text once typing pauses for `debounceMs`, and at once on clear or Enter. */
  onSearch: (query: string) => void;
  debounceMs?: number;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Search box with a debounced callback and a clear button. Escape clears the text (and does
 * not close a surrounding dialog while there is text to clear); Enter searches immediately.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    label,
    value,
    onSearch,
    debounceMs = SEARCH_DEBOUNCE_MS,
    placeholder = 'Search',
    className,
    autoFocus,
  },
  ref,
) {
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle<HTMLInputElement | null, HTMLInputElement | null>(
    ref,
    () => inputRef.current,
  );
  // Last text handed to onSearch, so the debounce only fires for new text.
  const emitted = useRef(value ?? '');
  // Latest callback, so a parent re-render does not restart the timer.
  const callback = useRef(onSearch);
  useEffect(() => {
    callback.current = onSearch;
  }, [onSearch]);

  // Follow a value set from outside (for example a reset).
  useEffect(() => {
    if (value === undefined || value === emitted.current) return;
    emitted.current = value;
    setDraft(value);
  }, [value]);

  const emit = (text: string) => {
    if (text === emitted.current) return;
    emitted.current = text;
    callback.current(text);
  };

  useEffect(() => {
    if (draft === emitted.current) return undefined;
    const timer = window.setTimeout(() => emit(draft), debounceMs);
    return () => window.clearTimeout(timer);
  }, [draft, debounceMs]);

  const clear = () => {
    setDraft('');
    emit('');
    inputRef.current?.focus();
  };

  return (
    <div className={cx('relative', className)}>
      <IconSearch
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-subtle"
      />
      <input
        ref={inputRef}
        type="search"
        aria-label={label}
        value={draft}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            emit(draft);
          } else if (e.key === 'Escape' && draft !== '') {
            e.preventDefault();
            e.stopPropagation();
            clear();
          }
        }}
        className="search-input h-8 w-full rounded border border-line-strong bg-bg pl-7 pr-7 text-sm text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
      />
      {draft !== '' ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={clear}
          className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-subtle hover:bg-raised hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <IconClose size={12} />
        </button>
      ) : null}
    </div>
  );
});
