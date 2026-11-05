import { Dropdown } from './Dropdown';
import { IconChevronDown } from './Icons';
import { cx } from '@/utils/cx';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  /** Accessible name; shown before the value unless `hideLabel`. */
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onValueChange: (value: T) => void;
  hideLabel?: boolean;
  align?: 'start' | 'end';
  className?: string;
}

/**
 * Compact single-choice picker for toolbars, built on Dropdown: the menu lists the options as
 * radio items (checked = current), with the same keyboard handling (arrows, Home / End,
 * type-ahead, Escape). Use SelectField for labelled form fields instead.
 */
export function Select<T extends string>({
  label,
  value,
  options,
  onValueChange,
  hideLabel = false,
  align = 'start',
  className,
}: SelectProps<T>) {
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <Dropdown
      align={align}
      width="w-48"
      items={[
        { type: 'label', id: 'label', label },
        ...options.map((o) => ({
          id: o.value,
          label: o.label,
          textValue: o.label,
          checked: o.value === value,
          onSelect: () => onValueChange(o.value),
        })),
      ]}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`${label}: ${current}`}
          className={cx(
            'inline-flex h-6 max-w-full items-center gap-1 rounded border border-line bg-bg px-2 text-2xs text-fg hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus',
            className,
          )}
        >
          {hideLabel ? null : <span className="text-muted">{label}:</span>}
          <span className="truncate">{current}</span>
          <IconChevronDown size={12} aria-hidden="true" className="shrink-0 text-muted" />
        </button>
      )}
    />
  );
}
