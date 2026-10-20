import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { IconButton } from '@/components/Button';
import { IconCheck, IconDownload, IconPalette, IconTrash, IconUpload } from '@/components/Icons';
import { Popover } from '@/components/Popover';
import { useToast } from '@/components/Toast';
import { allThemes, resolveTheme, useThemeStore } from '@/store/themeStore';
import type { ThemeDefinition } from '@/types';
import { cx } from '@/utils/cx';
import { downloadJson } from '@/utils/download';

function Swatch({ theme }: { theme: ThemeDefinition }) {
  const t = theme.tokens;
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-8 overflow-hidden rounded-sm border border-line-strong"
    >
      <span className="flex-1" style={{ background: t.bg }} />
      <span className="flex-1" style={{ background: t.panel }} />
      <span className="flex-1" style={{ background: t.accent }} />
      <span className="flex-1" style={{ background: t.positive }} />
      <span className="flex-1" style={{ background: t.negative }} />
    </span>
  );
}

/** Theme picker in the command bar: switch, customise, import and export themes. */
export function ThemeMenu() {
  const { activeThemeId, customThemes } = useThemeStore(
    useShallow((s) => ({ activeThemeId: s.activeThemeId, customThemes: s.customThemes })),
  );
  const setActiveTheme = useThemeStore((s) => s.setActiveTheme);
  const openBuilder = useThemeStore((s) => s.openBuilder);
  const deleteCustomTheme = useThemeStore((s) => s.deleteCustomTheme);
  const importTheme = useThemeStore((s) => s.importTheme);
  const notify = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const themes = allThemes(customThemes);

  const onFile = async (file: File) => {
    setError(null);
    if (file.size > 20_000) {
      setError('Theme file is too large (max 20 KB).');
      return;
    }
    try {
      const json: unknown = JSON.parse(await file.text());
      const result = importTheme(json);
      if (result.ok) notify({ message: 'Theme imported', tone: 'success' });
      else setError(result.error);
    } catch {
      setError('That file is not valid JSON.');
    }
  };

  return (
    <Popover
      label="Theme"
      width="w-72"
      trigger={(props) => <IconButton {...props} label="Theme" icon={IconPalette} size="md" />}
    >
      {(close) => (
        <div className="p-1.5">
          <p className="px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-muted">
            Theme
          </p>
          <ul role="listbox" aria-label="Themes">
            {themes.map((t) => {
              const active = t.id === activeThemeId;
              return (
                <li
                  key={t.id}
                  role="option"
                  aria-selected={active}
                  className="group flex items-center"
                >
                  <button
                    type="button"
                    onClick={() => setActiveTheme(t.id)}
                    className={cx(
                      'flex flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-raised',
                      active && 'text-accent',
                    )}
                  >
                    <Swatch theme={t} />
                    <span className="flex-1 truncate">{t.name}</span>
                    {active ? <IconCheck size={14} /> : null}
                  </button>
                  {!t.builtIn ? (
                    <IconButton
                      label={`Delete ${t.name}`}
                      icon={IconTrash}
                      size="xs"
                      onClick={() => deleteCustomTheme(t.id)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="mt-1 flex flex-col gap-0.5 border-t border-line pt-1">
            <button
              type="button"
              className="rounded px-2 py-1.5 text-left text-sm hover:bg-raised"
              onClick={() => {
                openBuilder();
                close();
              }}
            >
              Customise current theme…
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-raised"
              onClick={() => {
                const theme = resolveTheme(activeThemeId, customThemes);
                downloadJson(`${theme.id}.theme.json`, theme);
              }}
            >
              <IconDownload size={14} /> Export current theme
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-raised"
              onClick={() => fileInput.current?.click()}
            >
              <IconUpload size={14} /> Import theme JSON…
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
                e.target.value = '';
              }}
            />
            {error ? (
              <p role="alert" className="px-2 py-1 text-2xs text-neg">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </Popover>
  );
}
