import { memo, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/StateViews';
import { useSymbolDetail } from '@/hooks/useSymbolDetail';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { sanitizeText } from '@/utils/sanitize';
import { formatIstTime } from '@/utils/time';
import { filterArticles, titleCase } from './model';
import type { NewsArticle, ResearchFeedConfig, ResearchFeedData } from './types';

const SENTIMENT = {
  positive: { mark: '▲', cls: 'text-pos' },
  negative: { mark: '▼', cls: 'text-neg' },
  neutral: { mark: '■', cls: 'text-muted' },
} as const;

function Article({
  article,
  showSummary,
  onSymbol,
}: {
  article: NewsArticle;
  showSummary: boolean;
  onSymbol: ((s: string) => void) | null;
}) {
  const s = SENTIMENT[article.sentiment];
  const score = `${article.sentimentScore > 0 ? '+' : article.sentimentScore < 0 ? '−' : ''}${Math.abs(article.sentimentScore).toFixed(2)}`;
  return (
    <article className="border-b border-line px-3 py-2">
      <div className="flex items-center gap-2 text-2xs text-muted">
        <time className="num" dateTime={article.publishedAt}>
          {formatIstTime(Date.parse(article.publishedAt), false)}
        </time>
        <Badge>{titleCase(article.category)}</Badge>
        <span
          className={cx('font-medium', s.cls)}
          title="Sentiment score from −1 (negative) to +1 (positive)"
        >
          <span aria-hidden="true">{s.mark}</span> {titleCase(article.sentiment)}{' '}
          <span className="num">{score}</span>
        </span>
      </div>
      <h3 className="mt-0.5 text-sm font-medium leading-snug text-fg">
        {sanitizeText(article.headline)}
      </h3>
      {showSummary ? (
        <p className="mt-0.5 text-xs leading-snug text-muted">
          {sanitizeText(article.summary, 400)}
        </p>
      ) : null}
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-2xs text-subtle">
        <span>{sanitizeText(article.source, 80)}</span>
        {article.relevantTickers.map((ticker) =>
          onSymbol ? (
            <button
              key={ticker}
              type="button"
              onClick={() => onSymbol(ticker)}
              className="font-medium text-accent hover:underline"
            >
              {ticker}
            </button>
          ) : (
            <span key={ticker} className="font-medium text-accent">
              {ticker}
            </span>
          ),
        )}
      </p>
    </article>
  );
}

function ResearchFeed({
  data,
  config,
}: WidgetComponentProps<ResearchFeedConfig, ResearchFeedData>) {
  const articles = useMemo(() => filterArticles(data.articles, config), [data.articles, config]);
  const detail = useSymbolDetail();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-warn/30 bg-warn/5 px-3 py-1 text-2xs text-warn">
        <span className="font-semibold uppercase tracking-wide">Sample content</span>
        <span className="truncate text-muted">{data.disclaimer}</span>
      </div>
      {articles.length === 0 ? (
        <EmptyState title="No articles match" message="Change the sentiment or category filter." />
      ) : (
        <Virtuoso
          className="scroll-thin min-h-0 flex-1"
          data={articles}
          computeItemKey={(_, article) => article.articleId}
          itemContent={(_, article) => (
            <Article
              article={article}
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
