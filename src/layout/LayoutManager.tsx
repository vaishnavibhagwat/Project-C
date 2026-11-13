import { useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { IconDownload, IconSave, IconUpload } from '@/components/Icons';
import { Drawer } from '@/components/Overlay';
import { useToast } from '@/components/Toast';
import type { PageMeta } from '@/registry/pages';
import { describeApplyResult } from '@/store/actions';
import { useLayoutStore } from '@/store/layoutStore';
import { MAX_LAYOUT_BYTES } from '@/store/share';
import { LayoutBrowser } from './LayoutBrowser';
import {
  captureDashboard,
  exportPageLayout,
  importLayoutJson,
  lastValidLayout,
  startFresh,
  type ImportOutcome,
} from './layoutFile';
import { serializedBytes, toJSON } from './LayoutSerializer';
import { SaveLayoutDialog } from './SaveLayoutDialog';

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
  const notify = useToast();
  const [saveOpen, setSaveOpen] = useState(false);
  const [importError, setImportError] = useState<Extract<ImportOutcome, { ok: false }> | null>(
    null,
  );
  const lastValid = useLayoutStore((s) => s.lastValidByPage[page.id]);
  const fileInput = useRef<HTMLInputElement>(null);
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
        <div className="flex items-center gap-2">
          <Button variant="primary" icon={IconSave} onClick={() => setSaveOpen(true)}>
            Save layout…
          </Button>
          <p className="num text-2xs text-subtle">
            Layout JSON: {(bytes / 1024).toFixed(1)} KB of {MAX_LAYOUT_BYTES / 1024} KB budget.
          </p>
        </div>
        <LayoutBrowser page={page} />
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
      <SaveLayoutDialog open={saveOpen} onClose={() => setSaveOpen(false)} page={page} />
    </Drawer>
  );
}
