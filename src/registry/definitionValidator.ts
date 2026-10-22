import type { JSONSchema7, JSONSchema7Definition, JSONSchema7Type } from 'json-schema';
import { z } from 'zod';
import { ENDPOINT_IDS } from '@/data/endpoints';
import { WidgetCategory } from '@/types';
import { validateWidgetConfig } from './configValidator';

export interface DefinitionValidationResult {
  valid: boolean;
  /** One line per problem, prefixed with the field path, e.g. "minSize.w: ...". */
  errors: string[];
}

const REACT_LAZY = Symbol.for('react.lazy');
const REACT_WRAPPERS: ReadonlySet<symbol> = new Set([
  REACT_LAZY,
  Symbol.for('react.memo'),
  Symbol.for('react.forward_ref'),
]);

/** React tags lazy, memo and forwardRef components with a `$$typeof` symbol. */
function reactTag(value: unknown): symbol | undefined {
  if (typeof value !== 'object' || value === null || !('$$typeof' in value)) return undefined;
  const tag = value.$$typeof;
  return typeof tag === 'symbol' ? tag : undefined;
}

/** True for a component created with React.lazy(). */
export function isLazyComponent(value: unknown): boolean {
  return reactTag(value) === REACT_LAZY;
}

/** True for anything React can render as a component type (function, class, memo, ...). */
export function isComponentType(value: unknown): boolean {
  if (typeof value === 'function') return true;
  const tag = reactTag(value);
  return tag !== undefined && REACT_WRAPPERS.has(tag);
}

function compiles(pattern: string): boolean {
  try {
    new RegExp(pattern, 'u');
    return true;
  } catch {
    return false;
  }
}

const JsonValueSchema: z.ZodType<JSONSchema7Type> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

const TypeNameSchema = z.enum([
  'string',
  'number',
  'integer',
  'boolean',
  'object',
  'array',
  'null',
]);

/**
 * The JSON Schema subset the config validator supports (see SUPPORTED_SCHEMA_KEYWORDS), with
 * each keyword's value type. `.strict()` rejects any other keyword, so a schema can never rely
 * on a rule that would be silently skipped.
 */
const JsonSchemaSchema: z.ZodType<JSONSchema7, z.ZodTypeDef, unknown> = z.lazy(() =>
  z
    .object({
      $schema: z.string().optional(),
      $id: z.string().optional(),
      $comment: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      default: JsonValueSchema.optional(),
      examples: JsonValueSchema.optional(),
      readOnly: z.boolean().optional(),
      writeOnly: z.boolean().optional(),
      type: z.union([TypeNameSchema, z.array(TypeNameSchema).min(1)]).optional(),
      properties: z.record(SchemaDefinitionSchema).optional(),
      required: z.array(z.string()).optional(),
      additionalProperties: SchemaDefinitionSchema.optional(),
      enum: z.array(JsonValueSchema).min(1).optional(),
      const: JsonValueSchema.optional(),
      oneOf: z.array(SchemaDefinitionSchema).min(1).optional(),
      anyOf: z.array(SchemaDefinitionSchema).min(1).optional(),
      allOf: z.array(SchemaDefinitionSchema).min(1).optional(),
      minimum: z.number().optional(),
      maximum: z.number().optional(),
      exclusiveMinimum: z.number().optional(),
      exclusiveMaximum: z.number().optional(),
      multipleOf: z.number().positive().optional(),
      minLength: z.number().int().nonnegative().optional(),
      maxLength: z.number().int().nonnegative().optional(),
      pattern: z.string().refine(compiles, 'is not a valid regular expression').optional(),
    })
    .strict(),
);

/**
 * A subschema: `true`, `false` or a schema object. Written as a transform rather than
 * z.union so the nested errors keep their paths and messages instead of "Invalid input".
 */
const SchemaDefinitionSchema: z.ZodType<JSONSchema7Definition, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.unknown().transform((value, ctx): JSONSchema7Definition => {
    if (typeof value === 'boolean') return value;
    const parsed = JsonSchemaSchema.safeParse(value);
    if (parsed.success) return parsed.data;
    for (const issue of parsed.error.issues) ctx.addIssue(issue);
    return z.NEVER;
  }),
);

const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const KNOWN_ENDPOINTS: ReadonlySet<string> = new Set(ENDPOINT_IDS);

const SizeSchema = z.object({
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

const ConfigValueSchema = z.union([z.string(), z.number().finite(), z.boolean()]);

const DataSourceSchema = z.object({
  endpoint: z.string().refine((e) => KNOWN_ENDPOINTS.has(e), 'is not a known mock API endpoint'),
  wsChannel: z.string().min(1).optional(),
  refreshInterval: z.number().int().min(1000, 'must be at least 1000 ms'),
  latencyProfile: z.enum(['low', 'normal', 'high']),
});

type Size = z.infer<typeof SizeSchema>;

/** A React component field: "Required" when absent, `message` when it is the wrong kind. */
function componentField(isValid: (value: unknown) => boolean, message: string) {
  return z.unknown().superRefine((value, ctx) => {
    if (value === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required' });
    else if (!isValid(value)) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  });
}

/** The WidgetDefinition contract, field by field. Extra fields (registry helpers) are allowed. */
const DefinitionSchema = z
  .object({
    id: z.string().max(64).regex(KEBAB_CASE, 'must be kebab-case, e.g. "var-gauge"'),
    name: z.string().trim().min(1, 'must not be empty').max(80),
    description: z.string().trim().min(1, 'must not be empty'),
    category: z.nativeEnum(WidgetCategory),
    defaultSize: SizeSchema,
    minSize: SizeSchema,
    maxSize: SizeSchema.optional(),
    configSchema: JsonSchemaSchema,
    defaultConfig: z.record(ConfigValueSchema),
    component: componentField(isLazyComponent, 'must be a React.lazy() component'),
    icon: componentField(isComponentType, 'must be a React component'),
    dataSource: DataSourceSchema,
  })
  .superRefine((d, ctx) => {
    const add = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

    // Sizes: minSize <= defaultSize <= maxSize in both dimensions.
    const notLarger = (small: Size, large: Size, smallName: string, largeName: string) => {
      for (const axis of ['w', 'h'] as const) {
        if (small[axis] > large[axis]) {
          add([smallName, axis], `must not exceed ${largeName}.${axis} (${large[axis]})`);
        }
      }
    };
    notLarger(d.minSize, d.defaultSize, 'minSize', 'defaultSize');
    if (d.maxSize) notLarger(d.defaultSize, d.maxSize, 'defaultSize', 'maxSize');

    // configSchema describes an object of settings.
    const schema = d.configSchema;
    if (schema.type !== 'object') add(['configSchema', 'type'], 'must be "object"');

    // defaultConfig: one valid default for every setting the schema describes, and no others.
    const properties = schema.properties ?? {};
    for (const key of Object.keys(properties)) {
      if (!Object.hasOwn(d.defaultConfig, key)) {
        add(['defaultConfig', key], 'missing a default for this configSchema property');
      }
    }
    for (const key of Object.keys(d.defaultConfig)) {
      if (!Object.hasOwn(properties, key)) {
        add(['defaultConfig', key], 'is not described by configSchema');
      }
    }
    for (const issue of validateWidgetConfig(d.defaultConfig, schema).errors) {
      const path = issue.path === '' ? [] : issue.path.split('.');
      add(['defaultConfig', ...path], issue.message);
    }
  });

/**
 * Check every WidgetDefinition contract field at runtime: types, non-empty text, a known
 * category and endpoint, consistent sizes, a lazy component, an icon component, and a
 * defaultConfig that satisfies the widget's own configSchema.
 *
 * Cross-field checks (sizes, defaults against the schema) run once the fields themselves are
 * well-formed, so fix the field errors first.
 */
export function validateWidgetDefinition(value: unknown): DefinitionValidationResult {
  const parsed = DefinitionSchema.safeParse(value);
  if (parsed.success) return { valid: true, errors: [] };
  const errors = parsed.error.issues.map((issue) =>
    issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
  );
  return { valid: false, errors };
}
