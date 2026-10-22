import { cx } from '@/utils/cx';
import { direction, directionArrow, formatPct } from '@/utils/format';

export interface DeltaProps {
  /** Change as a fraction (0.0123 = +1.23%). */
  value: number;
  /** Optional pre-formatted text; defaults to a signed percentage. */
  text?: string;
  digits?: number;
  className?: string;
  /** Hide the arrow when space is tight; the +/- sign still conveys direction. */
  arrow?: boolean;
}

/** Signed change with arrow and colour. Direction is never conveyed by colour alone. */
export function Delta({ value, text, digits = 2, className, arrow = true }: DeltaProps) {
  const d = direction(value);
  return (
    <span
      className={cx(
        'num inline-flex items-center gap-0.5 whitespace-nowrap',
        d === 'up' && 'text-pos',
        d === 'down' && 'text-neg',
        d === 'flat' && 'text-muted',
        className,
      )}
    >
      {arrow ? (
        <span aria-hidden="true" className="text-[0.7em]">
          {directionArrow(value)}
        </span>
      ) : null}
      {text ?? formatPct(value, digits)}
    </span>
  );
}
