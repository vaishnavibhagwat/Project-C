import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/utils/cx';
import { IconChevronDown } from './Icons';

interface FieldShellProps {
  label: string;
  description?: string;
  error?: string | null;
  children: (ids: { inputId: string; describedBy: string | undefined }) => ReactNode;
  inline?: boolean;
}

/** Label + description + error wiring shared by every control. */
export function FieldShell({
  label,
  description,
  error,
  children,
  inline = false,
}: FieldShellProps) {
  const inputId = useId();
  const descId = useId();
  const errId = useId();
  const describedBy =
    [description ? descId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div
      className={cx(
        'flex gap-1',
        inline ? 'flex-row items-center justify-between gap-3' : 'flex-col',
      )}
    >
      <div className="min-w-0">
        <label htmlFor={inputId} className="block text-xs font-medium text-fg">
          {label}
        </label>
        {description ? (
          <p id={descId} className="text-2xs text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {children({ inputId, describedBy })}
      {error ? (
        <p id={errId} role="alert" className="text-2xs text-neg">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputBase =
  'h-8 w-full rounded border border-line-strong bg-bg px-2 text-sm text-fg placeholder:text-subtle focus:border-accent focus:outline-none';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  description?: string;
  error?: string | null;
  onValueChange: (value: string) => void;
}

export function TextField({
  label,
  description,
  error,
  onValueChange,
  className,
  ...rest
}: TextFieldProps) {
  return (
    <FieldShell label={label} description={description} error={error}>
      {({ inputId, describedBy }) => (
        <input
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cx(inputBase, rest.type === 'number' && 'num text-right', className)}
          onChange={(e) => onValueChange(e.target.value)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export interface SelectFieldProps {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onValueChange: (value: string) => void;
  error?: string | null;
}

export function SelectField({
  label,
  description,
  value,
  options,
  onValueChange,
  error,
}: SelectFieldProps) {
  return (
    <FieldShell label={label} description={description} error={error}>
      {({ inputId, describedBy }) => (
        <div className="relative">
          <select
            id={inputId}
            aria-describedby={describedBy}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className={cx(inputBase, 'appearance-none pr-7')}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <IconChevronDown
            size={14}
            className="pointer-events-none absolute right-2 top-2 text-muted"
          />
        </div>
      )}
    </FieldShell>
  );
}

export interface SwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({ label, description, checked, onCheckedChange }: SwitchProps) {
  return (
    <FieldShell label={label} description={description} inline>
      {({ inputId, describedBy }) => (
        <button
          id={inputId}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={describedBy}
          onClick={() => onCheckedChange(!checked)}
          className={cx(
            'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
            checked ? 'border-accent bg-accent' : 'border-line-strong bg-raised',
          )}
        >
          <span
            aria-hidden="true"
            className={cx(
              'inline-block h-3.5 w-3.5 rounded-full transition-transform',
              checked ? 'translate-x-4 bg-accent-fg' : 'translate-x-0.5 bg-muted',
            )}
          />
        </button>
      )}
    </FieldShell>
  );
}

export interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onValueChange: (value: T) => void;
  size?: 'xs' | 'sm';
  hideLabel?: boolean;
}

/** Compact radio group (range selectors, view toggles). Arrow keys move the selection. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onValueChange,
  size = 'xs',
  hideLabel = true,
}: SegmentedProps<T>) {
  const labelId = useId();
  const move = (delta: number) => {
    const idx = options.findIndex((o) => o.value === value);
    const next = options[(idx + delta + options.length) % options.length];
    if (next) onValueChange(next.value);
  };
  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className={hideLabel ? 'sr-only' : 'text-xs text-muted'}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="inline-flex rounded border border-line-strong bg-bg p-0.5"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            move(1);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            move(-1);
          }
        }}
      >
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onValueChange(o.value)}
              className={cx(
                'rounded-sm font-medium transition-colors',
                size === 'xs' ? 'h-5 px-1.5 text-2xs' : 'h-6 px-2 text-xs',
                selected ? 'bg-raised text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
