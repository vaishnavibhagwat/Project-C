import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { TextAreaField, TextField } from '@/components/FormControls';
import { Modal } from '@/components/Overlay';
import { useToast } from '@/components/Toast';
import type { PageMeta } from '@/registry/pages';
import { captureSnapshot } from '@/store/actions';
import { layoutHistory } from '@/store/history';
import { MAX_VERSIONS, useLayoutStore } from '@/store/layoutStore';
import type { Layout } from '@/types';
import { toIstIso } from '@/utils/time';
import { captureDashboard } from './layoutFile';
import { toJSON } from './LayoutSerializer';

type SaveMode = 'update' | 'new';

function SaveForm({
  page,
  active,
  onDone,
}: {
  page: PageMeta;
  active: Layout | undefined;
  onDone: () => void;
}) {
  const notify = useToast();
  const [name, setName] = useState(active?.name ?? `${page.short} layout`);
  const [description, setDescription] = useState(active?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = (mode: SaveMode) => {
    if (!name.trim()) {
      setError('Enter a name for the layout.');
      return;
    }
    const now = toIstIso(Date.now());
    const snapshot = captureSnapshot(page.id);
    const api = useLayoutStore.getState();
    let message: string;
    if (mode === 'update' && active) {
      const version = api.saveVersion(active.id, snapshot, '', now);
      api.updateDetails(active.id, name, description, now);
      message = `Saved “${name.trim()}” as v${version ?? 1}`;
    } else {
      api.saveLayout(name, snapshot, now, description);
      message = active ? `Saved a new layout “${name.trim()}”` : `Saved “${name.trim()}”`;
    }
    api.setLastValid(page.id, toJSON(captureDashboard(page.id)));
    // An explicit save is the new baseline: undo history starts again from here.
    layoutHistory.clear();
    notify({ message, tone: 'success' });
    onDone();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save(active ? 'update' : 'new');
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
      <TextField
        label="Name"
        value={name}
        maxLength={60}
        required
        error={error}
        onValueChange={(v) => {
          setName(v);
          if (v.trim()) setError(null);
        }}
      />
      <TextAreaField
        label="Description"
        description="Optional. Shown in the layout browser."
        value={description}
        maxLength={500}
        onValueChange={setDescription}
      />
      <p className="text-2xs text-muted">
        {active
          ? `Save adds version ${(active.versions.at(-1)?.version ?? 0) + 1} to “${active.name}” (the last ${MAX_VERSIONS} versions are kept). Save as new leaves “${active.name}” as it is and creates a separate layout.`
          : 'Saves the current widgets, positions and settings of this page in this browser.'}
      </p>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        {active ? (
          <Button type="button" onClick={() => save('new')}>
            Save as new
          </Button>
        ) : null}
        <Button type="submit" variant="primary">
          Save
        </Button>
      </div>
    </form>
  );
}

/**
 * Manual save: name and description. With a saved layout loaded on the page, Save adds a
 * version to it and "Save as new" creates a separate layout with a new UUID.
 */
export function SaveLayoutDialog({
  open,
  onClose,
  page,
}: {
  open: boolean;
  onClose: () => void;
  page: PageMeta;
}) {
  const active = useLayoutStore((s) =>
    s.savedLayouts.find((l) => l.id === s.activeByPage[page.id]),
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={active ? `Save “${active.name}”` : 'Save layout'}
      description={`${page.title}: grid positions and widget settings, never market data.`}
    >
      <SaveForm page={page} active={active} onDone={onClose} />
    </Modal>
  );
}
