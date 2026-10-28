import { z } from 'zod';
import type { GridConfig, ShareRecord, ThemeTokens } from '@/types';
import { GRID_LIMITS } from '@/utils/gridLayout';

/** zod schemas for everything that is persisted or shared. Datasets are never included. */

export const PAGE_IDS = ['workstation', 'risk', 'holdings', 'performance', 'research'] as const;
export const PageIdSchema = z.enum(PAGE_IDS);
export const BreakpointSchema = z.enum(['desktop', 'tablet', 'mobile']);

const gridInt = z.number().int().min(0).max(500);

export const GridItemSchema = z.object({
  i: z.string().min(1).max(64),
  x: gridInt,
  y: gridInt,
  w: z.number().int().min(1).max(24),
  h: z.number().int().min(1).max(100),
  minW: z.number().int().min(1).max(24).optional(),
  minH: z.number().int().min(1).max(100).optional(),
  maxW: z.number().int().min(1).max(24).optional(),
  maxH: z.number().int().min(1).max(100).optional(),
});

const layoutList = z.array(GridItemSchema).max(60).optional();

/**
 * Layouts per breakpoint. Data saved before the desktop/tablet/mobile breakpoints used
 * lg/md/sm/xs: lg becomes desktop and sm (6 columns, like tablet) becomes tablet. md (10
 * columns) and xs (2 columns) are dropped; the grid regenerates missing layouts from desktop.
 */
export const BreakpointLayoutsSchema = z.preprocess(
  (raw) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
    if ('desktop' in raw || 'tablet' in raw || 'mobile' in raw) return raw;
    const legacy: Record<string, unknown> = {};
    if ('lg' in raw) legacy.desktop = raw.lg;
    if ('sm' in raw) legacy.tablet = raw.sm;
    return legacy;
  },
  z.object({ desktop: layoutList, tablet: layoutList, mobile: layoutList }),
);

export const ConfigValueSchema = z.union([z.string().max(200), z.number().finite(), z.boolean()]);

export const GridPositionSchema = z.object({
  x: gridInt,
  y: gridInt,
  w: z.number().int().min(1).max(24),
  h: z.number().int().min(1).max(100),
});

const configRecord = z.record(z.string().max(64), ConfigValueSchema);

const CurrentWidgetInstanceSchema = z.object({
  instanceId: z.string().min(1).max(64),
  widgetId: z.string().min(1).max(64),
  config: configRecord,
  position: GridPositionSchema,
  title: z.string().max(80).optional(),
  collapsed: z.record(BreakpointSchema, z.number().int().min(1).max(200)).optional(),
});

/** Shape used before the spec-aligned WidgetInstance (saved layouts and share links). */
const LegacyWidgetInstanceSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.string().min(1).max(64),
  title: z.string().max(80),
  config: configRecord,
});

/**
 * Widget instance as persisted or shared. Older data ({ id, type, title, config }) is upgraded
 * on load; its placeholder position is replaced by the grid layout when the page is shown.
 */
export const WidgetInstanceSchema = z.preprocess((raw) => {
  const legacy = LegacyWidgetInstanceSchema.safeParse(raw);
  if (!legacy.success) return raw;
  return {
    instanceId: legacy.data.id,
    widgetId: legacy.data.type,
    config: legacy.data.config,
    title: legacy.data.title,
    position: { x: 0, y: 0, w: 4, h: 6 },
  };
}, CurrentWidgetInstanceSchema);

/** Grid settings, each within the range the brief allows. */
export const GridConfigSchema = z.object({
  cols: z.number().int().min(GRID_LIMITS.cols.min).max(GRID_LIMITS.cols.max),
  rowHeight: z.number().int().min(GRID_LIMITS.rowHeight.min).max(GRID_LIMITS.rowHeight.max),
  gap: z.number().int().min(GRID_LIMITS.gap.min).max(GRID_LIMITS.gap.max),
  compaction: z.enum(['vertical', 'none']),
}) satisfies z.ZodType<GridConfig>;

export const PageSnapshotSchema = z.object({
  page: PageIdSchema,
  layouts: BreakpointLayoutsSchema,
  instances: z.array(WidgetInstanceSchema).max(60),
  grid: GridConfigSchema.optional(),
});

export const ShareRecordSchema = z.object({
  id: z.string().min(1).max(80),
  page: PageIdSchema,
  url: z.string().url().max(120_000),
  bytes: z.number().int().nonnegative(),
  createdAt: z.string(),
}) satisfies z.ZodType<ShareRecord>;

export const LayoutVersionSchema = z.object({
  version: z.number().int().positive(),
  createdAt: z.string(),
  note: z.string().max(120),
  snapshot: PageSnapshotSchema,
});

export const LayoutSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  page: PageIdSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  versions: z.array(LayoutVersionSchema).min(1).max(50),
});

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #RRGGBB');

export const ThemeTokensSchema: z.ZodType<ThemeTokens> = z.object({
  bg: hex,
  panel: hex,
  raised: hex,
  border: hex,
  borderStrong: hex,
  text: hex,
  textMuted: hex,
  textSubtle: hex,
  accent: hex,
  accentContrast: hex,
  positive: hex,
  negative: hex,
  warning: hex,
  focus: hex,
  chart1: hex,
  chart2: hex,
  chart3: hex,
  chart4: hex,
  chart5: hex,
  chart6: hex,
});

export const ThemeSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(40),
  mode: z.enum(['dark', 'light']),
  tokens: ThemeTokensSchema,
  builtIn: z.boolean(),
});

/** Shared-link payload: one page snapshot plus the theme it was designed with. */
export const SharePayloadSchema = z.object({
  v: z.literal(1),
  snapshot: PageSnapshotSchema,
  themeId: z.string().max(64).optional(),
});

export type SharePayload = z.infer<typeof SharePayloadSchema>;
