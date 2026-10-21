import { useMemo } from 'react';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { getPageMeta } from '@/registry/pages';
import { applySnapshot } from '@/store/actions';
import { decodeShare } from '@/store/share';
import { useThemeStore } from '@/store/themeStore';
import type { PageId } from '@/types';

/** Shown when the URL carries ?share=…: preview what will change and let the user apply it. */
export function SharedLayoutBanner({
  encoded,
  page,
  onDone,
}: {
  encoded: string;
  page: PageId;
  onDone: () => void;
}) {
  const decoded = useMemo(() => decodeShare(encoded), [encoded]);
  const setActiveTheme = useThemeStore((s) => s.setActiveTheme);
  const notify = useToast();

  if (!decoded.ok) {
    return (
      <div
        role="alert"
        className="mb-2 flex items-center gap-3 rounded border border-neg/40 bg-neg/10 px-3 py-2 text-xs text-neg"
      >
        <span className="flex-1">Could not open shared layout: {decoded.error}</span>
        <Button size="sm" onClick={onDone}>
          Dismiss
        </Button>
      </div>
    );
  }
  const { snapshot, themeId } = decoded.payload;
  const target = getPageMeta(snapshot.page);
  return (
    <div
      role="status"
      className="mb-2 flex flex-wrap items-center gap-3 rounded border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-fg"
    >
      <span className="flex-1">
        Shared layout for <strong>{target.title}</strong> with {snapshot.instances.length} widgets.
        Applying it replaces the current {target.short} layout
        {snapshot.page === page ? '' : ` (you are on ${getPageMeta(page).short})`}.
      </span>
      <Button
        size="sm"
        variant="primary"
        onClick={() => {
          const result = applySnapshot(snapshot.page, snapshot);
          if (themeId) setActiveTheme(themeId);
          notify({
            message: `Shared layout applied${result.dropped > 0 ? ` (${result.dropped} widget${result.dropped === 1 ? '' : 's'} left out)` : ''}`,
            tone: 'success',
          });
          onDone();
        }}
      >
        Apply layout
      </Button>
      <Button size="sm" onClick={onDone}>
        Dismiss
      </Button>
    </div>
  );
}
