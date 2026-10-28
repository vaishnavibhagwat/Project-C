import type { ReactNode, Ref } from 'react';
import { cx } from '@/utils/cx';
import { Badge } from './Badge';
import { IconButton } from './Button';
import { IconAlert, IconChevronDown, IconClose, IconDrag, IconSettings } from './Icons';
import { LoadingSkeleton } from './LoadingSkeleton';
import { DisconnectedState, EmptyState, ErrorState } from './StateViews';

/** Class of the header area react-grid-layout drags by (its `draggableHandle`). */
export const DRAG_HANDLE_CLASS = 'widget-drag-handle';
/** Class of header controls that must not start a drag (its `draggableCancel`). */
export const NO_DRAG_CLASS = 'widget-no-drag';

/**
 * What the body shows. `ready` renders `children`; the others render the shell's own state
 * views, so every widget gets the same loading, error, empty and disconnected states.
 */
export type WidgetShellStatus = 'loading' | 'error' | 'empty' | 'disconnected' | 'ready';

export interface WidgetShellProps {
  /** Widget name or the user's title: the heading and the region's aria-label. */
  title: string;
  status: WidgetShellStatus;
  /** Body slot, shown when status is `ready`. */
  children?: ReactNode;
  /** Footer slot, below the body (hidden while collapsed). */
  footer?: ReactNode;
  /** Loading placeholder; defaults to the generic widget-shaped LoadingSkeleton. */
  skeleton?: ReactNode;
  /** Error state: a descriptive message and a Retry action. */
  errorMessage?: string;
  onRetry?: () => void;
  retrying?: boolean;
  /** Empty state message under "No data available". */
  emptyMessage?: string;
  /** Disconnected state (no data yet and the feed is down). */
  disconnectedSince?: string;
  onReconnect?: () => void;
  /** Count shown next to the title, e.g. active alerts. Hidden when null or undefined. */
  badgeCount?: number | null;
  /** Last update time as displayed, e.g. "14:32:05 IST". */
  lastUpdated?: string | null;
  /** Data is older than 2× the refresh interval: amber border and a "Stale" badge. */
  stale?: boolean;
  /** Tooltip explaining why the data is stale. */
  staleReason?: string;
  /** Visually hidden, aria-live="polite" summary of the data (throttle it before passing). */
  summary?: string;
  /**
   * Narrow widget: hide the plain last-updated time so the title keeps its room (show it
   * elsewhere, e.g. in an info tooltip). The Stale badge is always shown.
   */
  compactHeader?: boolean;
  /** Show the drag grip and make the title area the drag handle. */
  draggable?: boolean;
  /** Collapse toggle; hidden when onToggleCollapse is not given. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Settings icon; hidden when not given. */
  onSettings?: () => void;
  /** Remove X; hidden when not given. Callers usually confirm first. */
  onRemove?: () => void;
  /** Extra header controls (info, refresh, duplicate), placed before settings. */
  actions?: ReactNode;
  /** A strip under the header, e.g. "Disconnected · showing data from …". */
  notice?: ReactNode;
  /** Dim the body (showing old data while disconnected). */
  dimmed?: boolean;
  /** aria-busy while fetching. */
  busy?: boolean;
  bodyRef?: Ref<HTMLDivElement>;
  /** Becomes data-testid; also useful for e2e selectors. */
  testId?: string;
  className?: string;
}

/**
 * The card around every widget: a header (drag grip, title, optional badge count, last-updated
 * time or Stale badge, extra actions, settings, collapse, remove), the body slot and an
 * optional footer slot. It owns the shared states — shimmer skeleton while loading, error with
 * Retry, "No data available", disconnected — and the accessibility contract: a labelled
 * region and a polite live summary. It holds no data logic; WidgetFrame wires it to the
 * widget's query, the stores and the grid.
 */
export function WidgetShell({
  title,
  status,
  children,
  footer,
  skeleton,
  errorMessage = 'Something went wrong.',
  onRetry,
  retrying = false,
  emptyMessage,
  disconnectedSince,
  onReconnect,
  badgeCount,
  lastUpdated,
  stale = false,
  staleReason,
  summary = '',
  compactHeader = false,
  draggable = false,
  collapsed = false,
  onToggleCollapse,
  onSettings,
  onRemove,
  actions,
  notice,
  dimmed = false,
  busy = false,
  bodyRef,
  testId,
  className,
}: WidgetShellProps) {
  let body: ReactNode;
  switch (status) {
    case 'loading':
      body = (
        <>
          <span className="sr-only">Loading {title}</span>
          {skeleton ?? <LoadingSkeleton shape="widget" />}
        </>
      );
      break;
    case 'error':
      body = <ErrorState message={errorMessage} onRetry={onRetry} retrying={retrying} />;
      break;
    case 'empty':
      body = <EmptyState message={emptyMessage} />;
      break;
    case 'disconnected':
      body = <DisconnectedState since={disconnectedSince} onReconnect={onReconnect} />;
      break;
    case 'ready':
      body = children;
      break;
  }

  return (
    <section
      role="region"
      aria-label={title}
      aria-busy={busy || status === 'loading'}
      data-stale={stale || undefined}
      data-collapsed={collapsed || undefined}
      data-testid={testId}
      className={cx(
        'flex h-full flex-col overflow-hidden rounded border bg-panel',
        stale ? 'border-warn' : 'border-line',
        className,
      )}
    >
      <header
        className={cx(
          'flex h-8 shrink-0 items-center gap-1 pl-1 pr-1',
          !collapsed && 'border-b border-line',
        )}
      >
        <div
          className={cx(
            DRAG_HANDLE_CLASS,
            'flex min-w-0 flex-1 items-center gap-1',
            draggable ? 'cursor-grab active:cursor-grabbing' : 'pl-1',
          )}
        >
          {draggable ? <IconDrag size={14} className="shrink-0 text-subtle" /> : null}
          <h2 className="truncate text-xs font-semibold text-fg">{title}</h2>
          {badgeCount !== null && badgeCount !== undefined ? (
            <span
              className="num inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 px-1 text-2xs font-semibold text-accent"
              aria-label={`${badgeCount} items`}
              data-testid="header-badge"
            >
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          ) : null}
        </div>
        <div className={cx(NO_DRAG_CLASS, 'flex shrink-0 items-center gap-0.5')}>
          {stale ? (
            <span className="flex items-center gap-1 px-1" title={staleReason}>
              <Badge tone="warning">
                <IconAlert size={10} className="mr-0.5" />
                Stale
              </Badge>
              {lastUpdated ? (
                <span className="num hidden whitespace-nowrap text-2xs font-medium text-warn sm:inline">
                  {lastUpdated}
                </span>
              ) : null}
            </span>
          ) : lastUpdated && !compactHeader ? (
            <span
              className="num hidden whitespace-nowrap px-1 text-2xs text-subtle sm:inline"
              title="Last updated"
            >
              {lastUpdated}
            </span>
          ) : null}
          {actions}
          {onSettings ? (
            <IconButton
              label={`Configure ${title}`}
              icon={IconSettings}
              size="xs"
              aria-haspopup="dialog"
              onClick={onSettings}
            />
          ) : null}
          {onToggleCollapse ? (
            <IconButton
              label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
              icon={IconChevronDown}
              size="xs"
              aria-expanded={!collapsed}
              className={cx('transition-transform', collapsed && '-rotate-90')}
              onClick={onToggleCollapse}
            />
          ) : null}
          {onRemove ? (
            <IconButton
              label={`Remove ${title}`}
              icon={IconClose}
              size="xs"
              aria-haspopup="dialog"
              onClick={onRemove}
            />
          ) : null}
        </div>
      </header>
      {collapsed ? null : (
        <>
          {notice}
          <div
            ref={bodyRef}
            data-widget-body
            className={cx('relative min-h-0 flex-1', dimmed && 'opacity-70')}
          >
            {body}
          </div>
          {footer ? (
            <footer className="shrink-0 border-t border-line px-3 py-1.5 text-2xs text-muted">
              {footer}
            </footer>
          ) : null}
        </>
      )}
      <p className="sr-only" aria-live="polite">
        {summary}
      </p>
    </section>
  );
}
