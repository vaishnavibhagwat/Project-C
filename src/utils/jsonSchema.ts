import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import type { ConfigValue, WidgetConfig } from '@/types';

export interface FieldOption {
  value: string;
  label: string;
}

export type SchemaField =
  | { kind: 'enum'; key: string; title: string; description?: string; options: FieldOption[] }
  | { kind: 'boolean'; key: string; title: string; description?: string }
  | {
      kind: 'number';
      key: string;
      title: string;
      description?: string;
      min?: number;
      max?: number;
      step: number;
      integer: boolean;
    }
  | { kind: 'string'; key: string; title: string; description?: string; maxLength?: number };

function asSchema(def: JSONSchema7Definition | undefined): JSONSchema7 | null {
  return def && typeof def === 'object' ? def : null;
}

function enumOptions(schema: JSONSchema7): FieldOption[] | null {
  if (schema.oneOf) {
    const options: FieldOption[] = [];
    for (const entry of schema.oneOf) {
      const s = asSchema(entry);
      if (s && typeof s.const === 'string')
        options.push({ value: s.const, label: s.title ?? s.const });
    }
    return options.length > 0 ? options : null;
  }
  if (schema.enum) {
    const values = schema.enum.filter((v): v is string => typeof v === 'string');
    return values.length > 0 ? values.map((v) => ({ value: v, label: v })) : null;
  }
  return null;
}

/** Turn a widget's JSON Schema (object of primitives) into form fields, in declared order. */
export function schemaFields(schema: JSONSchema7): SchemaField[] {
  const fields: SchemaField[] = [];
  for (const [key, def] of Object.entries(schema.properties ?? {})) {
    const s = asSchema(def);
    if (!s) continue;
    const title = s.title ?? key;
    const description = s.description;
    const options = enumOptions(s);
    if (options) {
      fields.push({ kind: 'enum', key, title, description, options });
    } else if (s.type === 'boolean') {
      fields.push({ kind: 'boolean', key, title, description });
    } else if (s.type === 'number' || s.type === 'integer') {
      fields.push({
        kind: 'number',
        key,
        title,
        description,
        min: s.minimum,
        max: s.maximum,
        step: s.multipleOf ?? (s.type === 'integer' ? 1 : 0.1),
        integer: s.type === 'integer',
      });
    } else if (s.type === 'string') {
      fields.push({ kind: 'string', key, title, description, maxLength: s.maxLength });
    }
  }
  return fields;
}

/** Validate one value against its field. Returns an error message or null. */
export function validateField(field: SchemaField, value: ConfigValue | undefined): string | null {
  switch (field.kind) {
    case 'enum':
      return typeof value === 'string' && field.options.some((o) => o.value === value)
        ? null
        : 'Choose one of the listed options.';
    case 'boolean':
      return typeof value === 'boolean' ? null : 'Expected on or off.';
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'Enter a number.';
      if (field.integer && !Number.isInteger(value)) return 'Enter a whole number.';
      if (field.min !== undefined && value < field.min) return `Minimum is ${field.min}.`;
      if (field.max !== undefined && value > field.max) return `Maximum is ${field.max}.`;
      return null;
    }
    case 'string':
      if (typeof value !== 'string') return 'Enter text.';
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        return `At most ${field.maxLength} characters.`;
      }
      return null;
  }
}

export function validateConfig(schema: JSONSchema7, config: WidgetConfig): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of schemaFields(schema)) {
    const error = validateField(field, config[field.key]);
    if (error) errors[field.key] = error;
  }
  return errors;
}
