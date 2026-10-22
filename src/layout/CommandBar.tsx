import { Badge } from '@/components/Badge';
import { IconSearch } from '@/components/Icons';
import { AUM_USD } from '@/data/dataset';
import { useDashboardStore } from '@/store/dashboardStore';
import { ThemeMenu } from '@/theme/ThemeMenu';
import type { PageId } from '@/types';
import { env } from '@/utils/env';
import { formatInrCompact, formatUsdCompact } from '@/utils/format';
import { FeedControl } from './FeedControl';
import { MarketStatus } from './MarketStatus';
import { Notifications } from './Notifications';
import { UserMenu } from './UserMenu';
import { WorkspaceSelector } from './WorkspaceSelector';

export interface CommandBarProps {
  /** Dashboard shown (or last shown), for the workspace selector. */
  page: PageId;
  onOpenSearch: () => void;
  onOpenLayouts: () => void;
}

/**
 * Compact top bar: wordmark, dashboard selector, global search, NSE status, last refresh,
 * simulated-data label, theme, notifications and profile.
 */
export function CommandBar({ page, onOpenSearch, onOpenLayouts }: CommandBarProps) {
  const currency = useDashboardStore((s) => s.displayCurrency);
  const aum =
    currency === 'USD'
      ? formatUsdCompact(AUM_USD)
      : formatInrCompact(AUM_USD * env.VITE_USD_INR_RATE);
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-panel px-3">
      <div className="hidden min-w-0 items-baseline gap-1.5 md:flex">
        <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-fg">
          {env.VITE_APP_NAME}
        </span>
        <span className="hidden whitespace-nowrap text-2xs text-subtle 2xl:inline">
          Portfolio Intelligence
        </span>
      </div>
      <span aria-hidden="true" className="hidden h-4 border-l border-line md:block" />
      <WorkspaceSelector page={page} onManageLayouts={onOpenLayouts} />
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-7 min-w-[1.75rem] items-center gap-2 rounded border border-line bg-bg px-2 text-xs text-subtle hover:border-line-strong sm:min-w-0 sm:flex-1 md:max-w-xs"
        aria-label="Search (Ctrl+K)"
      >
        <IconSearch size={13} />
        <span className="hidden truncate sm:inline">Search symbols, widgets, pages…</span>
        <kbd className="ml-auto hidden rounded border border-line-strong px-1 text-2xs sm:inline">
          Ctrl K
        </kbd>
      </button>
      <span
        className="num hidden whitespace-nowrap text-xs text-muted 2xl:inline"
        title="AUM at last close (simulated)"
      >
        AUM <span className="text-fg">{aum}</span>
      </span>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden lg:block">
          <MarketStatus />
        </div>
        <FeedControl />
        <Badge tone="warning" className="shrink-0">
          Simulated data
        </Badge>
        <span aria-hidden="true" className="hidden h-4 border-l border-line sm:block" />
        <ThemeMenu />
        <Notifications />
        <UserMenu />
      </div>
    </header>
  );
}
