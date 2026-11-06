import { useRef, useState } from 'react';
import { Button, IconButton } from '@/components/Button';
import { TextField } from '@/components/FormControls';
import { IconDownload, IconHistory, IconTrash, IconUpload } from '@/components/Icons';
import { Drawer } from '@/components/Overlay';
import { useToast } from '@/components/Toast';
import type { PageMeta } from '@/registry/pages';
import { applySnapshot, captureSnapshot, describeApplyResult } from '@/store/actions';
import { layoutHistory } from '@/store/history';
import { useLayoutStore } from '@/store/layoutStore';
import { MAX_LAYOUT_BYTES } from '@/store/share';
import type { Layout } from '@/types';
import { cx } from '@/utils/cx';
import { formatIstDateTime, toIstIso } from '@/utils/time';
import {
  captureDashboard,
  exportPageLayout,
  exportSavedLayout,
  importLayoutJson,
  lastValidLayout,
  startFresh,
  type ImportOutcome,
} from './layoutFile';
import { serializedBytes, toJSON } from './LayoutSerializer';

function SavedRow({
  layout,
  active,
  pageId,
}: {
  layout: Layout;
  active: boolean;
  pageId: PageMeta['id'];
}) {
  const saveVersion = useLayoutStore((s) => s.saveVersion);
  const deleteLayout = useLayoutStore((s) => s.deleteLayout);
  const setActive = useLayoutStore((s) => s.setActive);
  const notify = useToast();
  const [showVersions, setShowVersions] = useState(false);
  const latest = layout.versions[layout.versions.length - 1];

  const load = (version = latest) => {
    if (!version) return;
    const result = applySnapshot(pageId, version.snapshot);
    setActive(pageId, layout.id);
    notify({
      message: `Loaded “${layout.name}” v${version.version}${describeApplyResult(result)}`,
      tone: 'success',
    });
  };

  return (
    <li className={cx('rounded border p-2', active ? 'border-accent/60' : 'border-line')}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{layout.name}</p>
          <p className="num text-2xs text-subtle">
            v{latest?.version ?? 1} · {layout.versions.length} versions · updated{' '}
            {formatIstDateTime(Date.parse(layout.updatedAt))}
          </p>
        </div>
        <Button size="sm" onClick={() => load()}>
          Load
        </Button>
        <IconButton
          label={`Version history for ${layout.name}`}
          icon={IconHistory}
          active={showVersions}
          onClick={() => setShowVersions((v) => !v)}
        />
        <IconButton
          label={`Export ${layout.name}`}
          icon={IconDownload}
          onClick={() => exportSavedLayout(layout)}
        />
        <IconButton
          label={`Delete ${layout.name}`}
          icon={IconTrash}
          onClick={() => deleteLayout(layout.id)}
        />
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const v = saveVersion(layout.id, captureSnapshot(pageId), '', toIstIso(Date.now()));
            if (v) {
              layoutHistory.clear();
              notify({ message: `Saved “${layout.name}” as v${v}`, tone: 'success' });
            } else {
              notify({
                message: `Could not save a new version of “${layout.name}”`,
                tone: 'error',
              });
            }
          }}
        >
          Save current as new version
        </Button>
      </div>
      {showVersions ? (
        <ol
          className="mt-2 flex flex-col gap-1 border-t border-line pt-2"
          aria-label={`Versions of ${layout.name}`}
        >
          {[...layout.versions].reverse().map((v) => (
            <li key={v.version} className="flex items-center gap-2 text-xs">
              <span className="num w-8 text-fg">v{v.version}</span>
              <span className="num flex-1 truncate text-muted">
                {formatIstDateTime(Date.parse(v.createdAt))} · {v.note} ·{' '}
                {v.snapshot.instances.length} widgets
              </span>
              <Button size="sm" variant="ghost" onClick={() => load(v)}>
                Restore
              </Button>
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

/** Save, version, restore, export and import page layouts. Layout JSON only, never data. */
export function LayoutManager({
  open,
  onClose,
  page,
}: {
  open: boolean;
  onClose: () => void;
  page: PageMeta;
}) {
  const saved = useLayoutStore((s) => s.savedLayouts);
  const activeId = useLayoutStore((s) => s.activeByPage[page.id]);
  const saveLayout = useLayoutStore((s) => s.saveLayout);
  const notify = useToast();
  const [name, setName] = useState('');
  const [importError, setImportError] = useState<Extract<ImportOutcome, { ok: false }> | null>(
    null,
  );
  const lastValid = useLayoutStore((s) => s.lastValidByPage[page.id]);
  const fileInput = useRef<HTMLInputElement>(null);
  const forPage = saved.filter((l) => l.page === page.id);
  const bytes = open ? serializedBytes(toJSON(captureDashboard(page.id))) : 0;

  // Validate first; the page only changes when the whole file is valid.
  const importJson = (json: string, source: string) => {
    const outcome = importLayoutJson(page.id, json);
    if (!outcome.ok) {
      setImportError(outcome);
      return;
    }
    setImportError(null);
    notify({
      message: `${source} “${outcome.name}”${describeApplyResult(outcome.result)}`,
      tone: 'success',
    });
  };
  const importFile = async (file: File) => {
    if (file.size > MAX_LAYOUT_BYTES) {
      setImportError({
        ok: false,
        error: `Layout file is larger than the ${MAX_LAYOUT_BYTES / 1024} KB limit.`,
        issues: [],
      });
      return;
    }
    importJson(await file.text(), 'Imported');
  };
  const loadLastValid = () => {
    const json = lastValidLayout(page.id);
    if (json !== null) importJson(json, 'Loaded last valid layout');
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Layouts · ${page.short}`}
      description="Layouts store grid positions and widget settings only, never market data."
    >
      <div className="flex flex-col gap-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveLayout(
              name || `${page.short} layout`,
              captureSnapshot(page.id),
              toIstIso(Date.now()),
            );
            useLayoutStore.getState().setLastValid(page.id, toJSON(captureDashboard(page.id)));
            setName('');
            // An explicit save is the new baseline: undo history starts again from here.
            layoutHistory.clear();
            notify({ message: 'Layout saved', tone: 'success' });
          }}
        >
          <div className="flex-1">
            <TextField
              label="Save current layout as"
              placeholder={`${page.short} layout`}
              value={name}
              maxLength={60}
              onValueChange={setName}
            />
          </div>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </form>
        <p className="num text-2xs text-subtle">
          Current layout JSON: {(bytes / 1024).toFixed(1)} KB of {MAX_LAYOUT_BYTES / 1024} KB
          budget.
        </p>
        <section aria-labelledby="saved-heading">
          <h3
            id="saved-heading"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Saved for this page ({forPage.length})
          </h3>
          {forPage.length === 0 ? (
            <p className="text-xs text-muted">No saved layouts yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {forPage.map((l) => (
                <SavedRow key={l.id} layout={l} active={l.id === activeId} pageId={page.id} />
              ))}
            </ul>
          )}
        </section>
        <section className="border-t border-line pt-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={IconDownload} onClick={() => exportPageLayout(page.id)}>
              Export layout JSON
            </Button>
            <Button size="sm" icon={IconUpload} onClick={() => fileInput.current?.click()}>
              Import layout JSON…
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
              e.target.value = '';
            }}
          />
          {importError ? (
            <div
              role="alert"
              aria-labelledby="import-error-title"
              className="mt-3 rounded border border-neg/50 bg-neg/10 p-3 text-xs"
            >
              <p id="import-error-title" className="font-semibold text-neg">
                {importError.error} The current layout was not changed.
              </p>
              {importError.issues.length > 0 ? (
                <ul aria-label="Validation errors" className="mt-1.5 list-disc pl-4 text-fg">
                  {importError.issues.map((issue) => (
                    <li key={issue} className="num break-words">
                      {issue}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" disabled={lastValid === undefined} onClick={loadLastValid}>
                  Load last valid layout
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    startFresh(page.id);
                    setImportError(null);
                    notify({ message: `${page.short} reset to its default layout` });
                  }}
                >
                  Start fresh
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setImportError(null)}>
                  Dismiss
                </Button>
              </div>
              {lastValid === undefined ? (
                <p className="mt-1.5 text-2xs text-muted">
                  No earlier valid layout for this page yet: one is kept each time you save, export
                  or import a layout.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </Drawer>
  );
}
