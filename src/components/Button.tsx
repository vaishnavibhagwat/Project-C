import { forwardRef, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from 'react';
import { cx } from '@/utils/cx';
import type { IconProps } from './Icons';
import { Tooltip, type TooltipSide } from './Tooltip';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ComponentType<IconProps>;
  /** Shows a spinner in place of the icon and disables the button (aria-busy). */
  loading?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent/90 border border-accent',
  secondary: 'bg-raised text-fg border border-line-strong hover:border-muted',
  ghost: 'text-muted hover:text-fg hover:bg-raised border border-transparent',
  danger: 'bg-neg/10 text-neg border border-neg/40 hover:bg-neg/20',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2 text-xs gap-1.5',
  md: 'h-8 px-3 text-sm gap-2',
  lg: 'h-9 px-4 text-sm gap-2',
};

const ICON_PX: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 16 };

/** Small rotating arc; static under prefers-reduced-motion (global.css). */
export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden="true"
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    loading = false,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex select-none items-center justify-center whitespace-nowrap rounded font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        loading && 'disabled:cursor-wait',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={ICON_PX[size]} /> : Icon ? <Icon size={ICON_PX[size]} /> : null}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name, also shown as the tooltip. */
  label: string;
  icon: ComponentType<IconProps>;
  size?: 'xs' | 'sm' | 'md';
  active?: boolean;
  /** Where the tooltip opens. */
  tooltipSide?: TooltipSide;
}

const ICON_SIZES = { xs: 'h-6 w-6', sm: 'h-7 w-7', md: 'h-8 w-8' } as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon: Icon,
    size = 'sm',
    active = false,
    tooltipSide = 'bottom',
    className,
    type = 'button',
    onPointerEnter,
    onPointerLeave,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  return (
    <Tooltip content={label} side={tooltipSide} decorative>
      {(tip) => (
        <button
          ref={ref}
          type={type}
          aria-label={label}
          className={cx(
            'inline-flex shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-raised hover:text-fg disabled:cursor-not-allowed disabled:opacity-40',
            active && 'bg-raised text-accent',
            ICON_SIZES[size],
            className,
          )}
          onPointerEnter={(e) => {
            tip.onPointerEnter(e);
            onPointerEnter?.(e);
          }}
          onPointerLeave={(e) => {
            tip.onPointerLeave();
            onPointerLeave?.(e);
          }}
          onFocus={(e) => {
            tip.onFocus(e);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            tip.onBlur();
            onBlur?.(e);
          }}
          {...rest}
        >
          <Icon size={size === 'xs' ? 14 : 16} />
        </button>
      )}
    </Tooltip>
  );
});
