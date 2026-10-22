import type { JSONSchema7 } from 'json-schema';
import { useMemo } from 'react';
import type { ConfigValue, WidgetConfig } from '@/types';
import { schemaFields } from '@/utils/jsonSchema';
import { SelectField, Switch, TextField } from './FormControls';

export interface SchemaFormProps {
  schema: JSONSchema7;
  value: WidgetConfig;
  /** Error message per setting key, e.g. from configErrorsByField(validateWidgetConfig(...)). */
  errors?: Readonly<Record<string, string>>;
  onChange: (key: string, value: ConfigValue) => void;
}

/** Renders a widget's configSchema as a form and shows the errors it is given per field. */
export function SchemaForm({ schema, value, errors = {}, onChange }: SchemaFormProps) {
  const fields = useMemo(() => schemaFields(schema), [schema]);
  if (fields.length === 0) {
    return <p className="text-xs text-muted">This widget has no configurable settings.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const current = value[field.key];
        const error = errors[field.key] ?? null;
        switch (field.kind) {
          case 'enum':
            return (
              <SelectField
                key={field.key}
                label={field.title}
                description={field.description}
                value={typeof current === 'string' ? current : (field.options[0]?.value ?? '')}
                options={field.options}
                onValueChange={(v) => onChange(field.key, v)}
                error={error}
              />
            );
          case 'boolean':
            return (
              <Switch
                key={field.key}
                label={field.title}
                description={field.description}
                checked={current === true}
                onCheckedChange={(v) => onChange(field.key, v)}
              />
            );
          case 'number':
            return (
              <TextField
                key={field.key}
                type="number"
                label={field.title}
                description={field.description}
                value={typeof current === 'number' ? String(current) : ''}
                min={field.min}
                max={field.max}
                step={field.step}
                error={error}
                onValueChange={(raw) => {
                  const n = raw === '' ? Number.NaN : Number(raw);
                  onChange(field.key, n);
                }}
              />
            );
          case 'string':
            return (
              <TextField
                key={field.key}
                label={field.title}
                description={field.description}
                value={typeof current === 'string' ? current : ''}
                maxLength={field.maxLength}
                error={error}
                onValueChange={(v) => onChange(field.key, v)}
              />
            );
        }
      })}
    </div>
  );
}
