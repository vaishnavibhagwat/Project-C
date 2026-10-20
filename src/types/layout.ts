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

export interface SavedLayout {
  id: string;
  name: string;
  page: PageId;
  createdAt: string;
  updatedAt: string;
  versions: LayoutVersion[];
}
