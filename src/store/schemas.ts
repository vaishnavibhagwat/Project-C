import { z } from 'zod';
import type { ThemeTokens } from '@/types';

/** zod schemas for everything that is persisted or shared. Datasets are never included. */

export const PAGE_IDS = ['workstation', 'risk', 'holdings', 'performance', 'research'] as const;
export const PageIdSchema = z.enum(PAGE_IDS);
export const BreakpointSchema = z.enum(['lg', 'md', 'sm', 'xs']);

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

export const BreakpointLayoutsSchema = z.object({
  lg: z.array(GridItemSchema).max(60).optional(),
  md: z.array(GridItemSchema).max(60).optional(),
  sm: z.array(GridItemSchema).max(60).optional(),
  xs: z.array(GridItemSchema).max(60).optional(),
});

export const ConfigValueSchema = z.union([z.string().max(200), z.number().finite(), z.boolean()]);

export const WidgetInstanceSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.string().min(1).max(64),
  title: z.string().max(80),
  config: z.record(z.string().max(64), ConfigValueSchema),
});

export const PageSnapshotSchema = z.object({
  page: PageIdSchema,
  layouts: BreakpointLayoutsSchema,
  instances: z.array(WidgetInstanceSchema).max(60),
});

export const LayoutVersionSchema = z.object({
  version: z.number().int().positive(),
  createdAt: z.string(),
  note: z.string().max(120),
  snapshot: PageSnapshotSchema,
});

export const SavedLayoutSchema = z.object({
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

export const ThemeDefinitionSchema = z.object({
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
