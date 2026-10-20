import { Badge } from '@/components/Delta';
import { IconSearch } from '@/components/Icons';
import { AUM_USD } from '@/data/dataset';
import { useDashboardStore } from '@/store/dashboardStore';
import { ThemeMenu } from '@/theme/ThemeMenu';
import { env } from '@/utils/env';
import { formatInrCompact, formatUsdCompact } from '@/utils/format';
import { FeedControl } from './FeedControl';
import { MarketStatus } from './MarketStatus';
import { Notifications } from './Notifications';
import { UserMenu } from './UserMenu';

/** Compact top bar: search, market status, data freshness, theme, notifications, user. */
export function CommandBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const currency = useDashboardStore((s) => s.displayCurrency);
  const aum =
    currency === 'USD'
      ? formatUsdCompact(AUM_USD)
      : formatInrCompact(AUM_USD * env.VITE_USD_INR_RATE);
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
      <div className="hidden min-w-0 items-baseline gap-2 md:flex">
        <span className="whitespace-nowrap text-sm font-semibold text-fg">{env.VITE_APP_NAME}</span>
        <span className="hidden whitespace-nowrap text-xs text-muted lg:inline">
          Portfolio Intelligence
        </span>
      </div>
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded border border-line bg-bg px-2 text-xs text-subtle hover:border-line-strong md:max-w-sm"
        aria-label="Search (Ctrl+K)"
      >
        <IconSearch size={13} />
        <span className="truncate">Search symbols, widgets, pages…</span>
        <kbd className="ml-auto hidden rounded border border-line-strong px-1 text-2xs sm:inline">
          Ctrl K
        </kbd>
      </button>
      <Badge tone="warning" className="shrink-0">
        Simulated data
      </Badge>
      <span
        className="num hidden whitespace-nowrap text-xs text-muted xl:inline"
        title="AUM at last close (simulated)"
      >
        AUM <span className="text-fg">{aum}</span>
      </span>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden lg:block">
          <MarketStatus />
        </div>
        <FeedControl />
        <ThemeMenu />
        <Notifications />
        <UserMenu />
      </div>
    </header>
  );
}
