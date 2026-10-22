import type { WidgetInstance } from './widget';

export type PageId = 'workstation' | 'risk' | 'holdings' | 'performance' | 'research';
export type AppRoute = PageId | 'marketplace' | 'settings';

/** Viewport classes: desktop ≥ 1280 px, tablet 768–1279 px, mobile < 768 px. */
export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

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
  /**
   * Grid settings the layouts were captured with, so they can be rescaled to the viewer's
   * grid. Absent in snapshots saved before grid settings existed (12 columns, 28 px rows).
   */
  grid?: GridConfig;
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

/** A share link the user created (LayoutStore.shares). */
export interface ShareRecord {
  id: string;
  page: PageId;
  url: string;
  /** Size of the layout JSON before compression, bytes. */
  bytes: number;
  /** IST ISO timestamp. */
  createdAt: string;
}

export type GridCompaction = 'vertical' | 'none';

/** User-adjustable grid settings (DashboardStore.gridConfig). */
export interface GridConfig {
  /** Desktop columns, 6 to 24. Default 12. Tablet uses 6 and mobile 1. */
  cols: number;
  /** Height of one grid row in px, 30 to 100. Default 60. */
  rowHeight: number;
  /** Gap between widgets in px (both directions), 4 to 20. Default 8. */
  gap: number;
  /** 'vertical' floats widgets up to fill gaps; 'none' leaves them where they are dropped. */
  compaction: GridCompaction;
}
