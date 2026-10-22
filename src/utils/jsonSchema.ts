import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';

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
