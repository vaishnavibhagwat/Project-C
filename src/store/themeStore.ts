import { z } from 'zod';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { ThemeDefinition, ThemeTokenKey } from '@/types';
import { BUILT_IN_THEMES, DEFAULT_THEME_ID, MIDNIGHT_GRAPHITE } from '@/theme/themes';
import { sanitizeText } from '@/utils/sanitize';
import { ThemeDefinitionSchema } from './schemas';
import { createId, createValidatedStorage, devtoolsEnabled } from './storage';

export interface ThemeBuilderState {
  open: boolean;
  /** Working copy being edited; previewed live while the builder is open. */
  draft: ThemeDefinition | null;
}

interface ThemeData {
  activeThemeId: string;
  customThemes: ThemeDefinition[];
  builder: ThemeBuilderState;
}

export type ImportResult = { ok: true; id: string } | { ok: false; error: string };

interface ThemeActions {
  setActiveTheme: (id: string) => void;
  openBuilder: (baseThemeId?: string) => void;
  closeBuilder: () => void;
  setDraftToken: (key: ThemeTokenKey, hex: string) => void;
  setDraftName: (name: string) => void;
  setDraftMode: (mode: ThemeDefinition['mode']) => void;
  saveDraft: () => string | null;
  deleteCustomTheme: (id: string) => void;
  importTheme: (json: unknown) => ImportResult;
}

export type ThemeState = ThemeData & ThemeActions;

export function allThemes(custom: readonly ThemeDefinition[]): ThemeDefinition[] {
  return [...BUILT_IN_THEMES, ...custom];
}

export function resolveTheme(id: string, custom: readonly ThemeDefinition[]): ThemeDefinition {
  return allThemes(custom).find((t) => t.id === id) ?? MIDNIGHT_GRAPHITE;
}

const PersistedSchema = z.object({
  activeThemeId: z.string(),
  customThemes: z.array(ThemeDefinitionSchema).max(20),
});
type Persisted = z.infer<typeof PersistedSchema>;

export const useThemeStore = create<ThemeState>()(
  devtools(
    persist(
      immer((set, get) => ({
        activeThemeId: DEFAULT_THEME_ID,
        customThemes: [],
        builder: { open: false, draft: null },

        setActiveTheme: (id) =>
          set((s) => {
            s.activeThemeId = resolveTheme(id, s.customThemes).id;
          }),

        openBuilder: (baseThemeId) => {
          const { activeThemeId, customThemes } = get();
          const base = resolveTheme(baseThemeId ?? activeThemeId, customThemes);
          set((s) => {
            s.builder = {
              open: true,
              draft: {
                ...base,
                id: base.builtIn ? createId('theme') : base.id,
                name: base.builtIn ? `${base.name} (custom)` : base.name,
                builtIn: false,
                tokens: { ...base.tokens },
              },
            };
          });
        },

        closeBuilder: () =>
          set((s) => {
            s.builder = { open: false, draft: null };
          }),

        setDraftToken: (key, hex) =>
          set((s) => {
            if (s.builder.draft && /^#[0-9a-fA-F]{6}$/.test(hex)) {
              s.builder.draft.tokens[key] = hex.toLowerCase();
            }
          }),

        setDraftName: (name) =>
          set((s) => {
            if (s.builder.draft) s.builder.draft.name = name.slice(0, 40);
          }),

        setDraftMode: (mode) =>
          set((s) => {
            if (s.builder.draft) s.builder.draft.mode = mode;
          }),

        saveDraft: () => {
          const draft = get().builder.draft;
          if (!draft) return null;
          const theme: ThemeDefinition = {
            ...draft,
            name: sanitizeText(draft.name, 40) || 'Custom theme',
            builtIn: false,
          };
          set((s) => {
            const idx = s.customThemes.findIndex((t) => t.id === theme.id);
            if (idx >= 0) s.customThemes[idx] = theme;
            else s.customThemes.push(theme);
            s.activeThemeId = theme.id;
            s.builder = { open: false, draft: null };
          });
          return theme.id;
        },

        deleteCustomTheme: (id) =>
          set((s) => {
            s.customThemes = s.customThemes.filter((t) => t.id !== id);
            if (s.activeThemeId === id) s.activeThemeId = DEFAULT_THEME_ID;
          }),

        importTheme: (json) => {
          const parsed = ThemeDefinitionSchema.safeParse(json);
          if (!parsed.success) {
            const issue = parsed.error.issues[0];
            return {
              ok: false,
              error: issue
                ? `${issue.path.join('.') || 'theme'}: ${issue.message}`
                : 'Invalid theme',
            };
          }
          const theme: ThemeDefinition = {
            ...parsed.data,
            id: createId('theme'),
            name: sanitizeText(parsed.data.name, 40) || 'Imported theme',
            builtIn: false,
          };
          set((s) => {
            if (s.customThemes.length >= 20) s.customThemes.shift();
            s.customThemes.push(theme);
            s.activeThemeId = theme.id;
          });
          return { ok: true, id: theme.id };
        },
      })),
      {
        name: 'meridian:theme',
        version: 1,
        storage: createValidatedStorage<Persisted>(PersistedSchema),
        partialize: (s): Persisted => ({
          activeThemeId: s.activeThemeId,
          customThemes: s.customThemes,
        }),
      },
    ),
    { name: 'ThemeStore', enabled: devtoolsEnabled },
  ),
);

/** The theme that should be painted right now (the builder draft wins while previewing). */
export function selectPaintedTheme(s: ThemeState): ThemeDefinition {
  return s.builder.open && s.builder.draft
    ? s.builder.draft
    : resolveTheme(s.activeThemeId, s.customThemes);
}
