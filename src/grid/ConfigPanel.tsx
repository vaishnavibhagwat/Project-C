import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { TextField } from '@/components/FormControls';
import { Drawer } from '@/components/Overlay';
import { SchemaForm } from '@/components/SchemaForm';
import { useToast } from '@/components/Toast';
import type { WidgetEntry } from '@/registry/defineWidget';
import { endpointUrl } from '@/data/api';
import { getWidget } from '@/registry/registry';
import { useWidgetStore } from '@/store/widgetStore';
import type { ConfigValue, WidgetConfig, WidgetInstance } from '@/types';
import { validateConfig } from '@/utils/jsonSchema';
import { sanitizeText } from '@/utils/sanitize';

const FORM_ID = 'widget-config-form';

interface ConfigFormProps {
  instance: WidgetInstance;
  entry: WidgetEntry;
  onDone: () => void;
}

/** Keyed by instance id, so the draft starts fresh whenever a different widget is opened. */
function ConfigForm({ instance, entry, onDone }: ConfigFormProps) {
  const replaceConfig = useWidgetStore((s) => s.replaceConfig);
  const renameInstance = useWidgetStore((s) => s.renameInstance);
  const notify = useToast();
  const def = entry.definition;
  const [draft, setDraft] = useState<WidgetConfig>(() => entry.resolveConfig(instance.config));
  const [title, setTitle] = useState(instance.title ?? def.name);

  const errors = useMemo(() => validateConfig(def.configSchema, draft), [draft, def.configSchema]);
  const titleError = sanitizeText(title, 80).length === 0 ? 'Enter a title.' : null;
  const invalid = Object.keys(errors).length > 0 || titleError !== null;
  const onChange = (key: string, value: ConfigValue) => setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    if (invalid) return;
    replaceConfig(instance.instanceId, entry.resolveConfig(draft));
    // Store a custom title only when it differs from the widget's name.
    const clean = sanitizeText(title, 80);
    renameInstance(instance.instanceId, clean === def.name ? undefined : clean);
    onDone();
    notify({ message: 'Widget settings saved', tone: 'success' });
  };

  return (
    <form
      id={FORM_ID}
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <TextField
        label="Title"
        value={title}
        maxLength={80}
        onValueChange={setTitle}
        error={titleError}
      />
      <SchemaForm schema={def.configSchema} value={draft} onChange={onChange} />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded border border-line bg-bg p-3 text-2xs">
        <dt className="text-muted">Widget</dt>
        <dd className="text-fg">{def.name}</dd>
        <dt className="text-muted">Category</dt>
        <dd className="text-fg">{def.category}</dd>
        <dt className="text-muted">Data source</dt>
        <dd className="num text-fg">GET {endpointUrl(def.dataSource.endpoint)} (simulated)</dd>
        <dt className="text-muted">Refresh</dt>
        <dd className="num text-fg">
          every {Math.round(def.dataSource.refreshInterval / 1000)}s · stale after{' '}
          {Math.round((def.dataSource.refreshInterval * 2) / 1000)}s
        </dd>
        <dt className="text-muted">Size limits</dt>
        <dd className="num text-fg">
          min {def.minSize.w}×{def.minSize.h}
          {def.maxSize ? `, max ${def.maxSize.w}×${def.maxSize.h}` : ''}
        </dd>
      </dl>
      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button variant="ghost" onClick={() => setDraft({ ...def.defaultConfig })}>
          Reset to defaults
        </Button>
        <Button onClick={onDone}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={invalid}>
          Save
        </Button>
      </div>
    </form>
  );
}

/** Settings drawer for the widget whose gear icon was pressed. Edits a draft; Save applies. */
export function ConfigPanel() {
  const instance = useWidgetStore((s) => (s.settingsFor ? s.instances[s.settingsFor] : undefined));
  const closeSettings = useWidgetStore((s) => s.closeSettings);
  const entry = instance ? getWidget(instance.widgetId) : undefined;
  return (
    <Drawer
      open={Boolean(instance && entry)}
      onClose={closeSettings}
      title={
        instance ? `Configure · ${instance.title ?? entry?.definition.name ?? ''}` : 'Configure'
      }
      description={entry?.definition.description}
    >
      {instance && entry ? (
        <ConfigForm
          key={instance.instanceId}
          instance={instance}
          entry={entry}
          onDone={closeSettings}
        />
      ) : null}
    </Drawer>
  );
}
