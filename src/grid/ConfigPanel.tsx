import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { TextField } from '@/components/FormControls';
import { Drawer } from '@/components/Overlay';
import { SchemaForm } from '@/components/SchemaForm';
import { useToast } from '@/components/Toast';
import { endpointUrl } from '@/data/api';
import { configErrorsByField } from '@/registry/configValidator';
import type { RegisteredWidget } from '@/registry/defineWidget';
import { widgetRegistry } from '@/registry/registry';
import { configureWidget } from '@/store/actions';
import { useWidgetStore } from '@/store/widgetStore';
import type { ConfigValue, WidgetConfig, WidgetInstance } from '@/types';
import { sanitizeText } from '@/utils/sanitize';

const FORM_ID = 'widget-config-form';

interface ConfigFormProps {
  instance: WidgetInstance;
  widget: RegisteredWidget;
  onDone: () => void;
}

/** Keyed by instance id, so the draft starts fresh whenever a different widget is opened. */
function ConfigForm({ instance, widget, onDone }: ConfigFormProps) {
  const notify = useToast();
  const [draft, setDraft] = useState<WidgetConfig>(() => widget.resolveConfig(instance.config));
  const [title, setTitle] = useState(instance.title ?? widget.name);

  const errors = useMemo(
    () => configErrorsByField(widgetRegistry.validateConfig(widget.id, draft)),
    [draft, widget.id],
  );
  const titleError = sanitizeText(title, 80).length === 0 ? 'Enter a title.' : null;
  const invalid = Object.keys(errors).length > 0 || titleError !== null;
  const onChange = (key: string, value: ConfigValue) => setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    if (invalid) return;
    // Store a custom title only when it differs from the widget's name.
    const clean = sanitizeText(title, 80);
    configureWidget(
      instance.instanceId,
      widget.resolveConfig(draft),
      clean === widget.name ? undefined : clean,
    );
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
      <SchemaForm schema={widget.configSchema} value={draft} errors={errors} onChange={onChange} />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded border border-line bg-bg p-3 text-2xs">
        <dt className="text-muted">Widget</dt>
        <dd className="text-fg">{widget.name}</dd>
        <dt className="text-muted">Category</dt>
        <dd className="text-fg">{widget.category}</dd>
        <dt className="text-muted">Data source</dt>
        <dd className="num text-fg">GET {endpointUrl(widget.dataSource.endpoint)} (simulated)</dd>
        <dt className="text-muted">Refresh</dt>
        <dd className="num text-fg">
          every {Math.round(widget.dataSource.refreshInterval / 1000)}s · stale after{' '}
          {Math.round((widget.dataSource.refreshInterval * 2) / 1000)}s
        </dd>
        <dt className="text-muted">Size limits</dt>
        <dd className="num text-fg">
          min {widget.minSize.w}×{widget.minSize.h}
          {widget.maxSize ? `, max ${widget.maxSize.w}×${widget.maxSize.h}` : ''}
        </dd>
      </dl>
      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button variant="ghost" onClick={() => setDraft({ ...widget.defaultConfig })}>
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
  const widget = instance ? widgetRegistry.getWidget(instance.widgetId) : undefined;
  return (
    <Drawer
      open={Boolean(instance && widget)}
      onClose={closeSettings}
      title={instance ? `Configure · ${instance.title ?? widget?.name ?? ''}` : 'Configure'}
      description={widget?.description}
    >
      {instance && widget ? (
        <ConfigForm
          key={instance.instanceId}
          instance={instance}
          widget={widget}
          onDone={closeSettings}
        />
      ) : null}
    </Drawer>
  );
}
