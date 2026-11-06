import { AnimatePresence, m } from 'framer-motion';
import { memo, useCallback, useId, useMemo, useState } from 'react';
import { SentimentBadge } from '@/components/Badge';
import { IconClose } from '@/components/Icons';
import { SearchInput } from '@/components/SearchInput';
import { Select } from '@/components/Select';
import { EmptyState } from '@/components/StateViews';
import { useRealTimeData } from '@/data/queries';
import { NEWS_STREAM_URL } from '@/data/wsSimulator';
import { useEventBus } from '@/hooks/useEventBus';
import type { WidgetComponentProps } from '@/types';
import { formatIstTime, istDateKey, formatDateKey } from '@/utils/time';
import { filterArticles, mergeArticles, summarizeFeed } from './model';
import {
  NEWS_SOURCE_FILTERS,
  type FeedArticle,
  type NewsFeedConfig,
  type NewsFeedData,
  type NewsSourceFilter,
} from './types';

const SOURCE_OPTIONS = NEWS_SOURCE_FILTERS.map((s) => ({
  value: s,
  label: s === 'all' ? 'All sources' : s,
}));

function publishedLabel(iso: string, todayKey: string): string {
  const ms = Date.parse(iso);
  const day = istDateKey(ms);
  const time = formatIstTime(ms, false);
  return day === todayKey ? time : `${formatDateKey(day, false)}, ${time}`;
}

function Article({
  article,
  expanded,
  onToggle,
  todayKey,
}: {
  article: FeedArticle;
  expanded: boolean;
  onToggle: (id: string) => void;
  todayKey: string;
}) {
  const panelId = useId();
  return (
    <article className="border-b border-line px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted">
        <time className="num" dateTime={article.publishedAt}>
          {publishedLabel(article.publishedAt, todayKey)}
        </time>
        <span className="font-medium text-fg">{article.source}</span>
        <SentimentBadge sentiment={article.sentiment} score={article.sentimentScore} />
      </div>
      <h3 className="mt-1 text-xs font-medium text-fg">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => onToggle(article.articleId)}
          className="w-full text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {article.headline}
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {expanded ? (
          <m.div
            id={panelId}
            key="summary"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <p className="pt-1 text-xs text-muted">{article.summary}</p>
            {article.relevantTickers.length > 0 ? (
              <p className="pt-1 text-2xs text-subtle">
                Tickers: <span className="text-muted">{article.relevantTickers.join(', ')}</span>
              </p>
            ) : null}
          </m.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}

function NewsFeed({
  instanceId,
  onConfigChange,
  data,
  config,
}: WidgetComponentProps<NewsFeedConfig, NewsFeedData>) {
  // New stories arrive on the simulated stream between polls; the poll catches anything missed.
  const { lastMessage } = useRealTimeData(NEWS_STREAM_URL);
  const all = useMemo(
    () => mergeArticles(data.articles, lastMessage?.articles ?? [], data.sources),
    [data, lastMessage],
  );

  // Hook point: SYMBOL_SELECTED from another widget narrows the feed to that ticker.
  const [symbol, setSymbol] = useState<string | null>(null);
  useEventBus('SYMBOL_SELECTED', (event) => {
    if (event.source !== instanceId) setSymbol(event.ticker);
  });

  const shown = useMemo(() => filterArticles(all, config, symbol), [all, config, symbol]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const todayKey = istDateKey(Date.parse(data.asOf));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-1.5">
        <SearchInput
          label="Filter news by keyword"
          placeholder="Keyword"
          value={config.keyword}
          onSearch={(keyword) => onConfigChange({ keyword })}
          className="min-w-[100px] flex-1"
        />
        <Select<NewsSourceFilter>
          label="Source"
          value={config.source}
          options={SOURCE_OPTIONS}
          onValueChange={(source) => onConfigChange({ source })}
          align="end"
        />
      </div>
      {symbol ? (
        <div className="flex items-center gap-1 px-3 pt-1.5 text-2xs text-muted">
          Showing news for
          <span className="inline-flex items-center gap-1 rounded border border-line-strong px-1.5 text-fg">
            {symbol}
            <button
              type="button"
              aria-label={`Show all news, not only ${symbol}`}
              onClick={() => setSymbol(null)}
              className="text-muted hover:text-fg"
            >
              <IconClose size={10} aria-hidden="true" />
            </button>
          </span>
        </div>
      ) : null}
      <p className="sr-only" role="status">
        {summarizeFeed(shown)}
      </p>
      {shown.length === 0 ? (
        <EmptyState
          title="No articles match"
          message={symbol ? `No recent stories mention ${symbol}.` : 'Clear the filters.'}
        />
      ) : (
        <ul aria-label="News articles" className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence initial={false}>
            {shown.map((a) => (
              <m.li
                key={a.articleId}
                initial={{ height: 0, opacity: 0, y: -12 }}
                animate={{ height: 'auto', opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
                className="overflow-hidden"
              >
                <Article
                  article={a}
                  expanded={expanded.has(a.articleId)}
                  onToggle={toggle}
                  todayKey={todayKey}
                />
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <p className="border-t border-line px-3 py-1 text-2xs text-subtle" title={data.disclaimer}>
        Sample research content · simulated stories; outlet names are labels only
      </p>
    </div>
  );
}

export default memo(NewsFeed);
