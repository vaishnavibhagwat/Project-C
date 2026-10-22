import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '@/utils/cx';

export interface ToggleProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'role'
> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
  /** Accessible name when no visible <label> points at the toggle. */
  label?: string;
}

const TRACK = { sm: 'h-4 w-7', md: 'h-5 w-9' } as const;
const KNOB = { sm: 'h-2.5 w-2.5', md: 'h-3.5 w-3.5' } as const;
const ON = { sm: 'translate-x-3.5', md: 'translate-x-4' } as const;

/** On/off switch (role="switch"). Space and Enter toggle it, like any button. */
export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { checked, onCheckedChange, size = 'md', label, className, onClick, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange(!checked);
      }}
      className={cx(
        'relative inline-flex shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-accent bg-accent' : 'border-line-strong bg-raised',
        TRACK[size],
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cx(
          'inline-block rounded-full transition-transform',
          checked ? cx(ON[size], 'bg-accent-fg') : 'translate-x-0.5 bg-muted',
          KNOB[size],
        )}
      />
    </button>
  );
});
