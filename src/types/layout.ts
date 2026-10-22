import type { WidgetInstance } from './widget';

export type PageId = 'workstation' | 'risk' | 'holdings' | 'performance' | 'research';
export type AppRoute = PageId | 'marketplace';

export type Breakpoint = 'lg' | 'md' | 'sm' | 'xs';

export interface GridItemLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export type BreakpointLayouts = Partial<Record<Breakpoint, GridItemLayout[]>>;

/** Everything needed to restore one page. Never contains chart datasets. */
export interface PageSnapshot {
  page: PageId;
  layouts: BreakpointLayouts;
  instances: WidgetInstance[];
}

export interface LayoutVersion {
  version: number;
  createdAt: string;
  note: string;
  snapshot: PageSnapshot;
}

/** A saved, versioned page layout (LayoutStore). */
export interface Layout {
  id: string;
  name: string;
  page: PageId;
  /** IST ISO timestamps. */
  createdAt: string;
  updatedAt: string;
  /** Oldest first; the last entry is the current version. */
  versions: LayoutVersion[];
}

/** react-grid-layout settings for the responsive dashboard grid. */
export interface GridConfig {
  /** Minimum container width (px) for each breakpoint. */
  breakpoints: Record<Breakpoint, number>;
  /** Number of columns at each breakpoint. */
  cols: Record<Breakpoint, number>;
  /** Height of one grid row, px. */
  rowHeight: number;
  /** Gap between widgets [x, y], px. */
  margin: [number, number];
  /** Padding inside the grid container [x, y], px. */
  containerPadding: [number, number];
  compactType: 'vertical' | 'horizontal' | null;
}
