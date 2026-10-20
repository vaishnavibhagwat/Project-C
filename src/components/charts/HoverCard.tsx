import type { ReactNode } from 'react';

export interface HoverCardProps {
  x: number;
  y: number;
  containerWidth: number;
  containerHeight: number;
  children: ReactNode;
}

/** Positioned tooltip for custom D3/SVG visualisations; flips to stay inside the widget. */
export function HoverCard({ x, y, containerWidth, containerHeight, children }: HoverCardProps) {
  const width = 180;
  const left = x + 12 + width > containerWidth ? Math.max(4, x - width - 12) : x + 12;
  const top = Math.min(Math.max(4, y - 10), Math.max(4, containerHeight - 90));
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded border border-line-strong bg-raised px-2.5 py-2 text-xs shadow-lg"
      style={{ left, top, width }}
    >
      {children}
    </div>
  );
}
