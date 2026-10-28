import { cx } from '@/utils/cx';

export type SkeletonShape = 'text' | 'chart' | 'table' | 'widget';

export interface LoadingSkeletonProps {
  shape?: SkeletonShape;
  /** Text lines or table rows (default 3 lines, 6 rows). */
  rows?: number;
  className?: string;
}

/** Fixed widths and heights so skeletons look like content without re-randomising. */
const LINE_WIDTHS = ['w-11/12', 'w-4/5', 'w-2/3', 'w-5/6', 'w-3/5', 'w-3/4'];
const BAR_HEIGHTS = [42, 66, 54, 80, 38, 70, 58, 90, 47, 62, 74, 51];

/**
 * One shimmering block. The shimmer is the `shimmer` @keyframes animation (tailwind.config.ts)
 * over theme colour tokens, so it follows the active theme; it stops under reduced motion.
 */
function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />;
}

function TextLines({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBlock key={i} className={cx('h-3', LINE_WIDTHS[i % LINE_WIDTHS.length])} />
      ))}
    </div>
  );
}

function ChartShape() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex gap-2">
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="h-3 w-14" />
      </div>
      <div className="flex min-h-12 flex-1 items-end gap-1 border-b border-l border-line pl-1">
        {BAR_HEIGHTS.map((h, i) => (
          <div key={i} className="skeleton flex-1 rounded-none" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

function TableShape({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-3 border-b border-line pb-1.5">
        <SkeletonBlock className="h-2.5 w-1/4" />
        <SkeletonBlock className="h-2.5 w-1/6" />
        <SkeletonBlock className="ml-auto h-2.5 w-1/6" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3">
          <SkeletonBlock className={cx('h-3', i % 2 === 0 ? 'w-1/3' : 'w-1/4')} />
          <SkeletonBlock className="h-3 w-1/6" />
          <SkeletonBlock className="ml-auto h-3 w-1/5" />
        </div>
      ))}
    </div>
  );
}

/**
 * Generic loading placeholder in four shapes: `text` (lines), `chart` (axis and bars), `table`
 * (header and rows) and `widget` (a heading, a chart and a few rows). Widgets with a more
 * specific layout use WidgetSkeleton. Decorative: hidden from assistive technology, which
 * reads the container's aria-busy and the shell's "Loading" text instead.
 */
export function LoadingSkeleton({ shape = 'widget', rows, className }: LoadingSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-testid={`loading-skeleton-${shape}`}
      className={cx('flex h-full w-full flex-col gap-3 overflow-hidden p-3', className)}
    >
      {shape === 'text' ? <TextLines rows={rows ?? 3} /> : null}
      {shape === 'chart' ? <ChartShape /> : null}
      {shape === 'table' ? <TableShape rows={rows ?? 6} /> : null}
      {shape === 'widget' ? (
        <>
          <div className="flex items-baseline gap-2">
            <SkeletonBlock className="h-5 w-24" />
            <SkeletonBlock className="h-3 w-12" />
          </div>
          <ChartShape />
          <TableShape rows={rows ?? 2} />
        </>
      ) : null}
    </div>
  );
}
