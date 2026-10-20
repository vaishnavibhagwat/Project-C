import type { SkeletonVariant } from '@/registry/defineWidget';

/** Static pseudo-random heights so skeletons look like data without re-randomising. */
const BAR_HEIGHTS = [42, 66, 54, 80, 38, 70, 58, 90, 47, 62, 74, 51];
const ROWS = 8;

function Block({ className }: { className: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** Shimmer skeleton shaped like the widget it stands in for. */
export function WidgetSkeleton({ variant }: { variant: SkeletonVariant }) {
  return (
    <div
      className="flex h-full w-full flex-col gap-2 overflow-hidden p-3"
      aria-hidden="true"
      data-testid={`skeleton-${variant}`}
    >
      {variant === 'line-chart' || variant === 'area-chart' ? (
        <>
          <div className="flex gap-2">
            <Block className="h-3 w-20" />
            <Block className="h-3 w-14" />
          </div>
          <div className="relative flex-1">
            <svg
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
              viewBox="0 0 100 40"
            >
              <polyline
                points="0,30 10,26 20,28 30,20 40,22 50,14 60,18 70,10 80,13 90,6 100,8"
                fill="none"
                stroke="rgb(var(--color-border-strong))"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col justify-between">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-px bg-line" />
              ))}
            </div>
          </div>
          <Block className="h-2 w-full" />
        </>
      ) : null}
      {variant === 'donut' ? (
        <div className="flex flex-1 items-center gap-4">
          <div className="skeleton aspect-square h-[70%] max-h-40 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Block key={i} className="h-3 w-full" />
            ))}
          </div>
        </div>
      ) : null}
      {variant === 'bars' ? (
        <div className="flex flex-1 items-end gap-1.5">
          {BAR_HEIGHTS.map((h, i) => (
            <div key={i} className="skeleton flex-1" style={{ height: `${h}%` }} />
          ))}
        </div>
      ) : null}
      {variant === 'table' ? (
        <div className="flex flex-1 flex-col gap-1.5">
          <Block className="h-4 w-full" />
          {Array.from({ length: ROWS }, (_, i) => (
            <div key={i} className="flex gap-2">
              <Block className="h-3 w-1/4" />
              <Block className="h-3 flex-1" />
              <Block className="h-3 w-1/6" />
              <Block className="h-3 w-1/6" />
            </div>
          ))}
        </div>
      ) : null}
      {variant === 'feed' ? (
        <div className="flex flex-1 flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col gap-1">
              <Block className="h-2 w-24" />
              <Block className="h-3 w-full" />
              <Block className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : null}
      {variant === 'gauge' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div className="skeleton h-20 w-40 rounded-t-full" />
          <div className="flex w-full gap-2">
            <Block className="h-8 flex-1" />
            <Block className="h-8 flex-1" />
          </div>
        </div>
      ) : null}
      {variant === 'tiles' ? (
        <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Block className="h-2 w-16" />
              <Block className="h-5 w-24" />
            </div>
          ))}
        </div>
      ) : null}
      {variant === 'heatmap' ? (
        <div className="grid flex-1 grid-cols-10 gap-0.5">
          {Array.from({ length: 60 }, (_, i) => (
            <div key={i} className="skeleton rounded-none" />
          ))}
        </div>
      ) : null}
      {variant === 'treemap' ? (
        <div className="grid flex-1 grid-cols-4 grid-rows-3 gap-0.5">
          <div className="skeleton col-span-2 row-span-2 rounded-none" />
          <div className="skeleton col-span-2 rounded-none" />
          <div className="skeleton rounded-none" />
          <div className="skeleton rounded-none" />
          <div className="skeleton rounded-none" />
          <div className="skeleton rounded-none" />
          <div className="skeleton col-span-2 rounded-none" />
        </div>
      ) : null}
    </div>
  );
}
