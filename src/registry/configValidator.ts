import type { JSONSchema7, JSONSchema7Definition, JSONSchema7TypeName } from 'json-schema';

/** One problem found in a value. `path` is the dotted property path ('' for the root). */
export interface ConfigIssue {
  path: string;
  /** The schema keyword that failed, e.g. "maximum". */
  keyword: string;
  message: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigIssue[];
}

/**
 * The JSON Schema (draft 7) keywords this validator understands. Widget settings are flat
 * objects of strings, numbers and booleans, so a small subset is enough. Any other keyword is
 * reported as an error instead of being silently ignored. Ajv is not used because it compiles
 * validators with `new Function`, which the CSP (script-src 'self', no unsafe-eval) blocks.
 */
const ANNOTATION_KEYWORDS = [
  '$schema',
  '$id',
  '$comment',
  'title',
  'description',
  'default',
  'examples',
  'readOnly',
  'writeOnly',
] as const;

const VALIDATION_KEYWORDS = [
  'type',
  'properties',
  'required',
  'additionalProperties',
  'enum',
  'const',
  'oneOf',
  'anyOf',
  'allOf',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
] as const;

export const SUPPORTED_SCHEMA_KEYWORDS: ReadonlySet<string> = new Set<string>([
  ...ANNOTATION_KEYWORDS,
  ...VALIDATION_KEYWORDS,
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function join(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}

function matchesType(type: JSONSchema7TypeName, value: unknown): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return isPlainObject(value);
    case 'array':
      return Array.isArray(value);
    case 'null':
      return value === null;
  }
}

const TYPE_MESSAGE: Record<JSONSchema7TypeName, string> = {
  string: 'Enter text.',
  number: 'Enter a number.',
  integer: 'Enter a whole number.',
  boolean: 'Expected true or false.',
  object: 'Expected an object.',
  array: 'Expected a list.',
  null: 'Expected null.',
};

function typeMessage(types: JSONSchema7TypeName[], value: unknown): string {
  const [only] = types;
  if (types.length > 1 || only === undefined) return `Expected ${types.join(' or ')}.`;
  if (only === 'integer' && !(typeof value === 'number' && Number.isFinite(value))) {
    return TYPE_MESSAGE.number;
  }
  return TYPE_MESSAGE[only];
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return typeof a === 'object' && a !== null && JSON.stringify(a) === JSON.stringify(b);
}

function describeValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** `Must be one of: 95, 99.` for a oneOf/anyOf list made only of `const` options. */
function constOptions(options: JSONSchema7Definition[]): unknown[] | null {
  const values: unknown[] = [];
  for (const option of options) {
    if (typeof option !== 'object' || option.const === undefined) return null;
    values.push(option.const);
  }
  return values;
}

function isMultipleOf(value: number, step: number): boolean {
  const quotient = value / step;
  return Math.abs(quotient - Math.round(quotient)) <= 1e-9 * Math.max(1, Math.abs(quotient));
}

function check(
  schema: JSONSchema7Definition,
  value: unknown,
  path: string,
  out: ConfigIssue[],
): void {
  const fail = (keyword: string, message: string, at = path) =>
    out.push({ path: at, keyword, message });

  if (schema === true) return;
  if (schema === false) {
    fail('false', 'Not allowed.');
    return;
  }
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_SCHEMA_KEYWORDS.has(key)) fail(key, `Unsupported schema keyword "${key}".`);
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(t, value))) {
      // The remaining keywords assume the right type, so stop here.
      fail('type', typeMessage(types, value));
      return;
    }
  }

  if (schema.const !== undefined && !sameValue(value, schema.const)) {
    fail('const', `Must be ${describeValue(schema.const)}.`);
  }
  if (schema.enum && !schema.enum.some((option) => sameValue(value, option))) {
    fail('enum', `Must be one of: ${schema.enum.map(describeValue).join(', ')}.`);
  }
  for (const keyword of ['oneOf', 'anyOf'] as const) {
    const options = schema[keyword];
    if (!options) continue;
    const matches = options.filter((option) => {
      const scratch: ConfigIssue[] = [];
      check(option, value, path, scratch);
      return scratch.length === 0;
    }).length;
    const ok = keyword === 'oneOf' ? matches === 1 : matches >= 1;
    if (ok) continue;
    const consts = constOptions(options);
    if (consts) fail(keyword, `Must be one of: ${consts.map(describeValue).join(', ')}.`);
    else if (matches > 1) fail(keyword, 'Matches more than one allowed option.');
    else fail(keyword, 'Does not match any allowed option.');
  }
  for (const sub of schema.allOf ?? []) check(sub, value, path, out);

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      fail('minimum', `Minimum is ${schema.minimum}.`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      fail('maximum', `Maximum is ${schema.maximum}.`);
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      fail('exclusiveMinimum', `Must be greater than ${schema.exclusiveMinimum}.`);
    }
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      fail('exclusiveMaximum', `Must be less than ${schema.exclusiveMaximum}.`);
    }
    if (schema.multipleOf !== undefined && !isMultipleOf(value, schema.multipleOf)) {
      fail('multipleOf', `Must be a multiple of ${schema.multipleOf}.`);
    }
  }

  if (typeof value === 'string') {
    // Count characters (code points), not UTF-16 units, as JSON Schema specifies.
    const length = [...value].length;
    if (schema.minLength !== undefined && length < schema.minLength) {
      fail('minLength', `At least ${schema.minLength} characters.`);
    }
    if (schema.maxLength !== undefined && length > schema.maxLength) {
      fail('maxLength', `At most ${schema.maxLength} characters.`);
    }
    if (schema.pattern !== undefined) {
      let pattern: RegExp | null = null;
      try {
        pattern = new RegExp(schema.pattern, 'u');
      } catch {
        fail('pattern', `Invalid pattern in schema: ${schema.pattern}`);
      }
      if (pattern && !pattern.test(value)) fail('pattern', 'Does not match the required format.');
    }
  }

  if (isPlainObject(value)) {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) fail('required', 'Required.', join(path, key));
    }
    const properties = schema.properties ?? {};
    for (const [key, item] of Object.entries(value)) {
      const at = join(path, key);
      const sub = properties[key];
      if (sub !== undefined) check(sub, item, at, out);
      else if (schema.additionalProperties === false)
        fail('additionalProperties', 'Unknown setting.', at);
      else if (schema.additionalProperties !== undefined) {
        check(schema.additionalProperties, item, at, out);
      }
    }
  }
}

/** Validate any JSON value against a schema, using the supported keyword subset. */
export function validateAgainstSchema(value: unknown, schema: JSONSchema7): ConfigValidationResult {
  const errors: ConfigIssue[] = [];
  check(schema, value, '', errors);
  return { valid: errors.length === 0, errors };
}

function isConfigValue(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

/**
 * Check a widget config against the widget's configSchema. On top of the schema, a config must
 * be a flat object whose values are text, finite numbers or booleans (the persisted
 * WidgetConfig shape). Keys the schema does not mention are allowed unless the schema sets
 * `additionalProperties: false`; missing keys are allowed unless listed in `required`, because
 * stored settings are merged over the widget's defaults.
 */
export function validateWidgetConfig(config: unknown, schema: JSONSchema7): ConfigValidationResult {
  if (!isPlainObject(config)) {
    return {
      valid: false,
      errors: [{ path: '', keyword: 'type', message: 'Expected an object.' }],
    };
  }
  const errors = validateAgainstSchema(config, schema).errors;
  // Schema messages are more specific ("Enter a number."), so only add the shape error for
  // keys the schema did not already reject.
  const flagged = new Set(errors.map((e) => e.path.split('.')[0]));
  for (const [key, value] of Object.entries(config)) {
    if (!isConfigValue(value) && !flagged.has(key)) {
      errors.push({
        path: key,
        keyword: 'type',
        message: 'Expected text, a number or true/false.',
      });
    }
  }
  return { valid: errors.length === 0, errors };
}

/** First error message per top-level setting, for showing next to form fields. */
export function configErrorsByField(result: ConfigValidationResult): Record<string, string> {
  const byField: Record<string, string> = {};
  for (const issue of result.errors) {
    const [field = ''] = issue.path.split('.');
    byField[field] ??= issue.message;
  }
  return byField;
}
