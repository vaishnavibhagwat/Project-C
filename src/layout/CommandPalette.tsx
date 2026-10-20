import { useId, useMemo, useState } from 'react';
import { IconSearch } from '@/components/Icons';
import { Modal } from '@/components/Overlay';
import { cx } from '@/utils/cx';
import { search, type SearchResult } from './searchIndex';

const KIND_LABEL = { page: 'Page', widget: 'Widget', symbol: 'Symbol', action: 'Command' } as const;

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
}

/** Global search (Ctrl/⌘+K): pages, widgets, Nifty 50 symbols and commands. */
export function CommandPalette({ open, onClose, onSelect }: CommandPaletteProps) {
  return (
    <Modal open={open} onClose={onClose} title="Search" className="max-w-xl">
      {open ? <PaletteBody onSelect={onSelect} /> : null}
    </Modal>
  );
}

function PaletteBody({ onSelect }: Pick<CommandPaletteProps, 'onSelect'>) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => search(query), [query]);
  const listId = useId();
  const current = results[Math.min(active, results.length - 1)];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <IconSearch
          size={15}
          className="pointer-events-none absolute left-2.5 top-2.5 text-subtle"
        />
        <input
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={current ? `${listId}-${current.id}` : undefined}
          aria-label="Search pages, widgets, symbols and commands"
          placeholder="Search pages, widgets, symbols (e.g. RELIANCE), commands…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && current) {
              e.preventDefault();
              onSelect(current);
            }
          }}
          className="h-9 w-full rounded border border-line-strong bg-bg pl-8 pr-2 text-sm text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
      </div>
      <ul id={listId} role="listbox" aria-label="Results" className="flex flex-col">
        {results.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-muted">No matches for “{query}”.</li>
        ) : null}
        {results.map((r, i) => (
          <li
            key={r.id}
            id={`${listId}-${r.id}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(r);
            }}
            className={cx(
              'flex cursor-pointer items-center gap-3 rounded px-2 py-1.5',
              i === active && 'bg-raised',
            )}
          >
            <span className="w-16 shrink-0 text-2xs font-semibold uppercase tracking-wide text-subtle">
              {KIND_LABEL[r.kind]}
            </span>
            <span className="truncate text-sm text-fg">{r.label}</span>
            <span className="ml-auto truncate text-xs text-muted">{r.hint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
