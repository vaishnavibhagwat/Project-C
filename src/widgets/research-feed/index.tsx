import { memo, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Badge } from '@/components/Delta';
import { EmptyState } from '@/components/StateViews';
import { useSymbolDetail } from '@/hooks/useSymbolDetail';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { sanitizeText } from '@/utils/sanitize';
import { formatIstTime } from '@/utils/time';
import { filterResearch } from './model';
import type { ResearchFeedConfig, ResearchFeedData, ResearchItem } from './types';

const SENTIMENT = {
  Positive: { mark: '▲', cls: 'text-pos' },
  Negative: { mark: '▼', cls: 'text-neg' },
  Neutral: { mark: '■', cls: 'text-muted' },
} as const;

function Item({
  item,
  showSummary,
  onSymbol,
}: {
  item: ResearchItem;
  showSummary: boolean;
  onSymbol: ((s: string) => void) | null;
}) {
  const s = SENTIMENT[item.sentiment];
  return (
    <article className="border-b border-line px-3 py-2">
      <div className="flex items-center gap-2 text-2xs text-muted">
        <time className="num" dateTime={item.publishedAt}>
          {formatIstTime(Date.parse(item.publishedAt), false)}
        </time>
        <Badge>{item.category}</Badge>
        <span className={cx('font-medium', s.cls)}>
          <span aria-hidden="true">{s.mark}</span> {item.sentiment}
        </span>
        {item.symbol ? (
          onSymbol ? (
            <button
              type="button"
              onClick={() => onSymbol(item.symbol ?? '')}
              className="ml-auto font-medium text-accent hover:underline"
            >
              {item.symbol}
            </button>
          ) : (
            <span className="ml-auto font-medium text-accent">{item.symbol}</span>
          )
        ) : null}
      </div>
      <h3 className="mt-0.5 text-sm font-medium leading-snug text-fg">
        {sanitizeText(item.headline)}
      </h3>
      {showSummary ? (
        <p className="mt-0.5 text-xs leading-snug text-muted">{sanitizeText(item.summary, 400)}</p>
      ) : null}
      <p className="mt-0.5 text-2xs text-subtle">{item.analyst} · Sample note</p>
    </article>
  );
}

function ResearchFeed({
  data,
  config,
}: WidgetComponentProps<ResearchFeedConfig, ResearchFeedData>) {
  const items = useMemo(() => filterResearch(data.items, config), [data.items, config]);
  const detail = useSymbolDetail();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-warn/30 bg-warn/5 px-3 py-1 text-2xs text-warn">
        <span className="font-semibold uppercase tracking-wide">Sample content</span>
        <span className="truncate text-muted">{data.disclaimer}</span>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No items match" message="Change the sentiment or category filter." />
      ) : (
        <Virtuoso
          className="scroll-thin min-h-0 flex-1"
          data={items}
          computeItemKey={(_, item) => item.id}
          itemContent={(_, item) => (
            <Item
              item={item}
              showSummary={config.showSummary}
              onSymbol={detail ? detail.openSymbol : null}
            />
          )}
        />
      )}
    </div>
  );
}

export default memo(ResearchFeed);
