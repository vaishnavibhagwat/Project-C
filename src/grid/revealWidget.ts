/** How long a revealed widget's border flashes (ms). Matches `.widget-flash` in global.css. */
export const FLASH_MS = 1600;

/** The grid cell of one widget instance inside `root`, if it is rendered. */
export function findGridCell(root: ParentNode | null, instanceId: string): HTMLElement | null {
  if (!root) return null;
  for (const cell of root.querySelectorAll<HTMLElement>('[data-instance-id]')) {
    if (cell.dataset.instanceId === instanceId) return cell;
  }
  return null;
}

/**
 * Scrolls a widget into view and moves focus to its region, so keyboard and screen reader
 * users land on it too. Returns false if the cell is not rendered.
 */
export function revealWidget(root: ParentNode | null, instanceId: string): boolean {
  const cell = findGridCell(root, instanceId);
  if (!cell) return false;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  cell.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  const region = cell.querySelector<HTMLElement>('[role="region"]') ?? cell;
  region.focus({ preventScroll: true });
  return true;
}

/** A reveal asked for before the target page is on screen (an alert on another page). */
interface PendingReveal {
  instanceId: string;
  at: number;
}

/** A pending reveal older than this is dropped, so a widget never flashes out of the blue. */
export const PENDING_REVEAL_MS = 5000;

let pending: PendingReveal | null = null;

/** Reveal `instanceId` once its page's grid has rendered it (see GridContainer). */
export function requestReveal(instanceId: string, now = Date.now()): void {
  pending = { instanceId, at: now };
}

/**
 * The pending reveal if it is for one of `itemIds` and still fresh. It stays pending until
 * `clearPendingReveal`, so a remounted grid (React StrictMode) still sees it.
 */
export function pendingRevealFor(itemIds: readonly string[], now = Date.now()): string | null {
  if (!pending) return null;
  if (now - pending.at > PENDING_REVEAL_MS) {
    pending = null;
    return null;
  }
  return itemIds.includes(pending.instanceId) ? pending.instanceId : null;
}

export function clearPendingReveal(): void {
  pending = null;
}

/** Ids for finding a widget across pages, without importing the stores here. */
export interface WidgetLocator {
  pages: Readonly<Record<string, { itemIds: readonly string[] }>>;
  widgetIdOf: (instanceId: string) => string | undefined;
}

/**
 * Where to show `widgetId`: the first instance on `current` if it has one, otherwise the first
 * instance on the other pages in `order`. Null if no page has it.
 */
export function locateWidget<P extends string>(
  widgetId: string,
  current: P | null,
  order: readonly P[],
  { pages, widgetIdOf }: WidgetLocator,
): { page: P; instanceId: string } | null {
  const pagesToSearch = current === null ? order : [current, ...order.filter((p) => p !== current)];
  for (const page of pagesToSearch) {
    const instanceId = pages[page]?.itemIds.find((id) => widgetIdOf(id) === widgetId);
    if (instanceId !== undefined) return { page, instanceId };
  }
  return null;
}
