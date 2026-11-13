import { useMemo, type CSSProperties } from 'react';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { ReadOnlyWidget } from '@/grid/ReadOnlyWidget';
import { useAppRoute } from '@/hooks/useAppRoute';
import { getPageMeta } from '@/registry/pages';
import { isPlaceholder } from '@/registry/placeholder';
import { useLayoutStore } from '@/store/layoutStore';
import { formatIstDateTime } from '@/utils/time';
import { loadSavedLayout, saveSharedCopy } from '../layoutFile';
import { decodeLayoutLink } from '../shareLink';
import { useShellContext } from '../shellContext';

/**
 * `#/shared?layout=…`: a layout someone shared, shown read-only with live simulated data. It
 * is never applied to the user's pages; "Save a copy" adds it to their saved layouts.
 */
export default function SharedLayoutPage() {
  const { params, navigate } = useAppRoute();
  const { lastPage } = useShellContext();
  const notify = useToast();
  const encoded = params.get('layout') ?? '';
  const decoded = useMemo(() => decodeLayoutLink(encoded), [encoded]);

  if (!decoded.ok) {
    return (
      <div role="alert" className="max-w-xl rounded border border-neg/40 bg-neg/10 p-4 text-sm">
        <h1 className="font-semibold text-neg">Could not open this shared layout</h1>
        <p className="mt-1 text-fg">{decoded.error}</p>
        {decoded.issues.length > 0 ? (
          <ul className="mt-2 list-disc pl-5 text-xs text-fg">
            {decoded.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
        <Button className="mt-3" size="sm" onClick={() => navigate(lastPage)}>
          Back to {getPageMeta(lastPage).short}
        </Button>
      </div>
    );
  }

  const { layout } = decoded;
  const widgets = layout.widgets.filter((w) => !isPlaceholder(w.widgetId));
  const rows = Math.max(...widgets.map((w) => w.position.desktop.y + w.position.desktop.h), 1);
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${layout.gridConfig.cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, ${layout.gridConfig.rowHeight}px)`,
    gap: `${layout.gridConfig.gap}px`,
  };
  const target = getPageMeta(lastPage);

  const saveCopy = () => {
    const id = saveSharedCopy(layout, lastPage);
    notify({
      tone: 'success',
      message: `Saved a copy to your ${target.short} layouts`,
      action: {
        label: 'Open it',
        onClick: () => {
          const saved = useLayoutStore.getState().savedLayouts.find((l) => l.id === id);
          if (saved && loadSavedLayout(saved, lastPage).ok) navigate(lastPage);
        },
      },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="status"
        className="flex flex-wrap items-center gap-3 rounded border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-fg"
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold">
            {layout.name} <span className="font-normal text-muted">· read-only shared layout</span>
          </h1>
          <p className="text-muted">
            Shared by {layout.createdBy} · {widgets.length} widgets · created{' '}
            {formatIstDateTime(Date.parse(layout.createdAt))}. Data is your own simulated feed.
          </p>
        </div>
        <Button size="sm" variant="primary" onClick={saveCopy}>
          Save a copy
        </Button>
        <Button size="sm" onClick={() => navigate(lastPage)}>
          Close
        </Button>
      </div>
      {layout.description ? <p className="text-xs text-muted">{layout.description}</p> : null}
      <div
        data-testid="shared-layout-grid"
        className="flex flex-col gap-2 lg:grid"
        style={gridStyle}
      >
        {widgets.map((w) => {
          const { x, y, w: width, h } = w.position.desktop;
          const cell: CSSProperties = {
            gridColumn: `${x + 1} / span ${width}`,
            gridRow: `${y + 1} / span ${h}`,
            minHeight: h * layout.gridConfig.rowHeight,
          };
          return (
            <div key={w.instanceId} style={cell} className="min-w-0">
              <ReadOnlyWidget
                instance={{
                  instanceId: w.instanceId,
                  widgetId: w.widgetId,
                  config: w.config,
                  position: w.position.desktop,
                  ...(w.title !== undefined ? { title: w.title } : {}),
                  ...(w.dataSource ? { dataSource: w.dataSource } : {}),
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
