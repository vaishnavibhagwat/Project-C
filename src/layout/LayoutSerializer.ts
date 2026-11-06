import { v4 as uuidv4, validate as isUuid, version as uuidVersion } from 'uuid';
import { z } from 'zod';
import { isPlaceholder } from '@/registry/placeholder';
import { widgetRegistry } from '@/registry/registry';
import {
  ConfigValueSchema,
  DataSourceOverridesSchema,
  GridConfigSchema,
  GridPositionSchema,
  PageSnapshotSchema,
  ThemeTokensSchema,
} from '@/store/schemas';
import { MAX_LAYOUT_BYTES } from '@/store/share';
import type {
  Breakpoint,
  BreakpointLayouts,
  GridConfig,
  GridItemLayout,
  GridPosition,
  PageId,
  PageSnapshot,
  Theme,
  WidgetInstance,
} from '@/types';
import { defaultTheme } from '@/theme/themes';
import { sanitizeText } from '@/utils/sanitize';
import { toIstIso } from '@/utils/time';
import {
  BREAKPOINT_KEYS,
  columnsFor,
  DEFAULT_GRID_CONFIG,
  GRID_BREAKPOINTS,
  LEGACY_GRID_CONFIG,
  MOBILE_COLS,
  TABLET_COLS,
} from '@/utils/gridLayout';

/**
 * Layout files: one dashboard page as a versioned, human-readable JSON document.
 *
 *   toJSON(state)  → pretty-printed JSON (2-space indent, fixed key order, no empty fields)
 *   fromJSON(text) → parse without prototype keys → zod → a validated LayoutDocument, or the
 *                    validation errors
 *   toSnapshot(layout, page) → the PageSnapshot the stores apply
 *
 * Layout files hold grid positions, widget settings and the theme, never market data.
 */

/** Format version written into every file (semver). Files with another major are refused. */
export const LAYOUT_FORMAT_VERSION = '1.0.0';
const SUPPORTED_MAJOR = 1;

/** Keys that could change an object's prototype if copied onto a plain object. */
const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/** Registry ids are kebab case; the empty slot type is the one exception. */
const WIDGET_ID = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*|__placeholder)$/;
const INSTANCE_ID = /^[A-Za-z0-9_-]+$/;

const safeKey = z
  .string()
  .min(1)
  .max(64)
  .refine((k) => !UNSAFE_KEYS.has(k), 'Reserved key');
const timestamp = z.string().datetime({ offset: true });
const uuidV4 = z.string().refine((v) => isUuid(v) && uuidVersion(v) === 4, 'Expected a UUID v4');

const BreakpointPositionsSchema = z.object({
  desktop: GridPositionSchema,
  tablet: GridPositionSchema.optional(),
  mobile: GridPositionSchema.optional(),
});

export const LayoutWidgetSchema = z.object({
  instanceId: z.string().min(1).max(64).regex(INSTANCE_ID, 'Letters, digits, - and _ only'),
  widgetId: z.string().min(1).max(64).regex(WIDGET_ID, 'Expected a kebab-case widget id'),
  title: z.string().max(80).optional(),
  position: BreakpointPositionsSchema,
  config: z.record(safeKey, ConfigValueSchema),
  dataSource: DataSourceOverridesSchema.optional(),
  /** Rows to restore per breakpoint while the widget is collapsed to its header. */
  collapsed: z
    .object({
      desktop: z.number().int().min(1).max(200).optional(),
      tablet: z.number().int().min(1).max(200).optional(),
      mobile: z.number().int().min(1).max(200).optional(),
    })
    .optional(),
});

const BreakpointSpecSchema = z.object({
  /** Smallest viewport width (px) that uses this breakpoint. */
  minWidth: z.number().int().min(0).max(10_000),
  cols: z.number().int().min(1).max(24),
});

export const LayoutThemeSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(40),
  mode: z.enum(['dark', 'light']),
  tokens: ThemeTokensSchema,
});

export const LayoutDocumentSchema = z
  .object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Expected a semver version such as 1.0.0'),
    id: uuidV4,
    name: z.string().min(1).max(60),
    description: z.string().max(500),
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: z.string().min(1).max(80),
    gridConfig: GridConfigSchema,
    widgets: z.array(LayoutWidgetSchema).max(60),
    theme: LayoutThemeSchema,
    breakpoints: z.object({
      desktop: BreakpointSpecSchema,
      tablet: BreakpointSpecSchema,
      mobile: BreakpointSpecSchema,
    }),
  })
  .superRefine((doc, ctx) => {
    const seen = new Set<string>();
    doc.widgets.forEach((w, i) => {
      if (seen.has(w.instanceId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['widgets', i, 'instanceId'],
          message: `Duplicate instanceId "${w.instanceId}"`,
        });
      }
      seen.add(w.instanceId);
      for (const bp of BREAKPOINT_KEYS) {
        const pos = w.position[bp];
        const cols = doc.breakpoints[bp].cols;
        if (pos && pos.x + pos.w > cols) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['widgets', i, 'position', bp],
            message: `Wider than the ${cols}-column ${bp} grid`,
          });
        }
      }
    });
    if (doc.breakpoints.desktop.cols !== doc.gridConfig.cols) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['breakpoints', 'desktop', 'cols'],
        message: 'Must equal gridConfig.cols',
      });
    }
  });

export type LayoutDocument = z.infer<typeof LayoutDocumentSchema>;
export type LayoutWidget = z.infer<typeof LayoutWidgetSchema>;
export type LayoutTheme = z.infer<typeof LayoutThemeSchema>;

/** What `toJSON` serialises: one page plus the file's own details. */
export interface DashboardState {
  snapshot: PageSnapshot;
  theme: Theme | LayoutTheme;
  meta: {
    /** UUID v4; a new one is created when absent. */
    id?: string;
    name: string;
    description?: string;
    /** ISO 8601 with offset. Both default to now (IST). */
    createdAt?: string;
    updatedAt?: string;
    createdBy: string;
  };
}

export type FromJsonResult =
  | {
      ok: true;
      layout: LayoutDocument;
      /** Widget ids this build does not have; they load as "Widget unavailable" placeholders. */
      unknownWidgetIds: string[];
      /** False for files in the older format, which carry no theme. */
      hasTheme: boolean;
    }
  | { ok: false; error: string; issues: string[] };

// ---------------------------------------------------------------------------------------------
// Serialising

const toPos = ({ x, y, w, h }: GridPosition): GridPosition => ({ x, y, w, h });

function widgetFor(instance: WidgetInstance, layouts: BreakpointLayouts): LayoutWidget {
  const at = (bp: Breakpoint): GridPosition | undefined => {
    const item = layouts[bp]?.find((l) => l.i === instance.instanceId);
    return item ? toPos(item) : undefined;
  };
  const tablet = at('tablet');
  const mobile = at('mobile');
  const { title, dataSource, collapsed } = instance;
  // Optional fields are left out rather than written as null, so the file stays short.
  return {
    instanceId: instance.instanceId,
    widgetId: instance.widgetId,
    ...(title !== undefined ? { title } : {}),
    position: {
      desktop: at('desktop') ?? toPos(instance.position),
      ...(tablet ? { tablet } : {}),
      ...(mobile ? { mobile } : {}),
    },
    config: { ...instance.config },
    ...(dataSource && Object.keys(dataSource).length > 0 ? { dataSource: { ...dataSource } } : {}),
    ...(collapsed ? { collapsed: { ...collapsed } } : {}),
  };
}

function breakpointsFor(grid: GridConfig): LayoutDocument['breakpoints'] {
  const cols = columnsFor(grid);
  return {
    desktop: { minWidth: GRID_BREAKPOINTS.desktop, cols: cols.desktop },
    tablet: { minWidth: GRID_BREAKPOINTS.tablet, cols: cols.tablet },
    mobile: { minWidth: GRID_BREAKPOINTS.mobile, cols: cols.mobile },
  };
}

/** The layout document for a page, with keys in a fixed, readable order. */
export function toDocument(state: DashboardState, now = Date.now()): LayoutDocument {
  const { snapshot, theme, meta } = state;
  const grid = snapshot.grid ?? DEFAULT_GRID_CONFIG;
  const stamp = toIstIso(now);
  return {
    version: LAYOUT_FORMAT_VERSION,
    id: meta.id ?? uuidv4(),
    name: sanitizeText(meta.name, 60) || 'Untitled layout',
    description: sanitizeText(meta.description ?? '', 500),
    createdAt: meta.createdAt ?? stamp,
    updatedAt: meta.updatedAt ?? stamp,
    createdBy: sanitizeText(meta.createdBy, 80) || 'Unknown',
    gridConfig: {
      cols: grid.cols,
      rowHeight: grid.rowHeight,
      gap: grid.gap,
      compaction: grid.compaction,
    },
    widgets: snapshot.instances.map((i) => widgetFor(i, snapshot.layouts)),
    theme: { id: theme.id, name: theme.name, mode: theme.mode, tokens: { ...theme.tokens } },
    breakpoints: breakpointsFor(grid),
  };
}

/** Pretty-printed layout JSON (2-space indent, trailing newline). */
export function toJSON(state: DashboardState, now = Date.now()): string {
  return `${JSON.stringify(toDocument(state, now), null, 2)}\n`;
}

export function serializedBytes(json: string): number {
  return new TextEncoder().encode(json).length;
}

// ---------------------------------------------------------------------------------------------
// Deserialising

/**
 * JSON.parse that drops `__proto__`, `constructor` and `prototype` keys at every depth, so
 * nothing parsed can reach an object's prototype when it is later copied or spread.
 */
export function parseJsonSafely(text: string): unknown {
  return JSON.parse(text, (key, value: unknown) => (UNSAFE_KEYS.has(key) ? undefined : value));
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
}

function invalid(error: string, issues: string[] = []): FromJsonResult {
  return { ok: false, error, issues };
}

function unknownIds(widgets: readonly LayoutWidget[]): string[] {
  const ids = widgets
    .map((w) => w.widgetId)
    .filter((id) => !isPlaceholder(id) && !widgetRegistry.hasWidget(id));
  return [...new Set(ids)];
}

/**
 * Files saved before this format: a bare page snapshot. Upgraded with a new id; they carry no
 * theme, so the default theme fills the field and `hasTheme: false` tells callers to keep theirs.
 */
function fromLegacySnapshot(raw: unknown, now: number): FromJsonResult | null {
  const legacy = PageSnapshotSchema.safeParse(raw);
  if (!legacy.success) return null;
  const doc = toDocument(
    {
      snapshot: { ...legacy.data, grid: legacy.data.grid ?? LEGACY_GRID_CONFIG },
      theme: defaultTheme(),
      meta: { name: 'Imported layout', createdBy: 'Unknown' },
    },
    now,
  );
  const checked = LayoutDocumentSchema.safeParse(doc);
  if (!checked.success) return invalid('Invalid layout file.', formatIssues(checked.error));
  return {
    ok: true,
    layout: checked.data,
    unknownWidgetIds: unknownIds(checked.data.widgets),
    hasTheme: false,
  };
}

/** Parse and validate layout JSON. Nothing is applied; see `toSnapshot`. */
export function fromJSON(json: string, now = Date.now()): FromJsonResult {
  if (serializedBytes(json) > MAX_LAYOUT_BYTES) {
    return invalid(`Layout JSON is larger than the ${MAX_LAYOUT_BYTES / 1024} KB limit.`);
  }
  let raw: unknown;
  try {
    raw = parseJsonSafely(json);
  } catch (e) {
    return invalid('This is not valid JSON.', [e instanceof Error ? e.message : String(e)]);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return invalid('A layout file must be a JSON object.');
  }
  if (!('version' in raw)) {
    return (
      fromLegacySnapshot(raw, now) ?? invalid('Not a layout file: the "version" field is missing.')
    );
  }
  const { version } = raw;
  const major = typeof version === 'string' ? Number(version.split('.')[0]) : NaN;
  if (Number.isInteger(major) && major !== SUPPORTED_MAJOR) {
    return invalid(
      `Layout format ${String(version)} is not supported. This build reads ${SUPPORTED_MAJOR}.x files.`,
    );
  }
  const parsed = LayoutDocumentSchema.safeParse(raw);
  if (!parsed.success) return invalid('Invalid layout file.', formatIssues(parsed.error));
  const layout: LayoutDocument = {
    ...parsed.data,
    name: sanitizeText(parsed.data.name, 60) || 'Untitled layout',
    description: sanitizeText(parsed.data.description, 500),
    createdBy: sanitizeText(parsed.data.createdBy, 80) || 'Unknown',
    widgets: parsed.data.widgets.map((w) =>
      w.title === undefined ? w : { ...w, title: sanitizeText(w.title, 80) || undefined },
    ),
    theme: {
      ...parsed.data.theme,
      name: sanitizeText(parsed.data.theme.name, 40) || 'Imported theme',
    },
  };
  return { ok: true, layout, unknownWidgetIds: unknownIds(layout.widgets), hasTheme: true };
}

/**
 * The page snapshot for a validated layout. Tablet and mobile positions are kept only when the
 * file's column counts match this build's (6 and 1); otherwise the grid derives them again from
 * desktop. Unknown widget ids are kept, so they show as placeholders.
 */
export function toSnapshot(layout: LayoutDocument, page: PageId): PageSnapshot {
  const fixedCols: Record<Breakpoint, number | null> = {
    desktop: null,
    tablet: TABLET_COLS,
    mobile: MOBILE_COLS,
  };
  const layouts: BreakpointLayouts = {};
  for (const bp of BREAKPOINT_KEYS) {
    const expected = fixedCols[bp];
    if (expected !== null && layout.breakpoints[bp].cols !== expected) continue;
    const items: GridItemLayout[] = layout.widgets.flatMap((w) => {
      const pos = w.position[bp];
      return pos ? [{ i: w.instanceId, ...pos }] : [];
    });
    if (bp === 'desktop' || items.length === layout.widgets.length) layouts[bp] = items;
  }
  return {
    page,
    layouts,
    grid: { ...layout.gridConfig },
    instances: layout.widgets.map((w): WidgetInstance => ({
      instanceId: w.instanceId,
      widgetId: w.widgetId,
      config: { ...w.config },
      position: { ...w.position.desktop },
      ...(w.title !== undefined ? { title: w.title } : {}),
      ...(w.dataSource ? { dataSource: { ...w.dataSource } } : {}),
      ...(w.collapsed ? { collapsed: { ...w.collapsed } } : {}),
    })),
  };
}

export const LayoutSerializer = {
  version: LAYOUT_FORMAT_VERSION,
  schema: LayoutDocumentSchema,
  toDocument,
  toJSON,
  fromJSON,
  toSnapshot,
} as const;
