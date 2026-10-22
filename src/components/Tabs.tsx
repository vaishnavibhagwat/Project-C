import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '@/utils/cx';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps<T extends string> {
  /** Accessible name of the tab list. */
  label: string;
  items: readonly TabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
}

/**
 * Tabs (WAI-ARIA tabs pattern). Arrow keys, Home and End move between tabs and select them;
 * only the selected tab is in the Tab order. Only the selected panel is rendered.
 */
export function Tabs<T extends string>({
  label,
  items,
  value,
  onValueChange,
  className,
}: TabsProps<T>) {
  const baseId = useId();
  const tabs = useRef(new Map<T, HTMLButtonElement>());
  const tabId = (v: T) => `${baseId}-tab-${v}`;
  const panelId = (v: T) => `${baseId}-panel-${v}`;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((item) => !item.disabled);
    const index = enabled.findIndex((item) => item.value === value);
    let next: TabItem<T> | undefined;
    if (event.key === 'ArrowRight') next = enabled[(index + 1) % enabled.length];
    else if (event.key === 'ArrowLeft')
      next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === 'Home') next = enabled[0];
    else if (event.key === 'End') next = enabled[enabled.length - 1];
    else return;
    event.preventDefault();
    if (!next) return;
    onValueChange(next.value);
    tabs.current.get(next.value)?.focus();
  };

  const active = items.find((item) => item.value === value);
  return (
    <div className={cx('flex min-h-0 flex-col', className)}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex shrink-0 gap-1 border-b border-line"
      >
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              ref={(node) => {
                if (node) tabs.current.set(item.value, node);
                else tabs.current.delete(item.value);
              }}
              type="button"
              role="tab"
              id={tabId(item.value)}
              aria-selected={selected}
              aria-controls={panelId(item.value)}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onValueChange(item.value)}
              className={cx(
                '-mb-px h-8 whitespace-nowrap border-b-2 px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                selected ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {active ? (
        <div
          role="tabpanel"
          id={panelId(active.value)}
          aria-labelledby={tabId(active.value)}
          tabIndex={0}
          className="min-h-0 pt-3 outline-none focus-visible:outline-2"
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
