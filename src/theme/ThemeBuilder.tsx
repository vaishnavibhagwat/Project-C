import { useState } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { Button } from '@/components/Button';
import { Segmented, TextField } from '@/components/FormControls';
import { Drawer } from '@/components/Overlay';
import { useToast } from '@/components/Toast';
import { useThemeStore } from '@/store/themeStore';
import { THEME_TOKEN_KEYS, type ThemeTokenKey, type ThemeTokens } from '@/types';
import { contrastRatio } from '@/utils/color';
import { cx } from '@/utils/cx';
import { TOKEN_LABELS } from './themes';

interface Check {
  label: string;
  fg: ThemeTokenKey;
  bg: ThemeTokenKey;
  /** WCAG 2.x AA threshold: 4.5 for body text, 3 for large text / UI parts. */
  min: number;
}

export const CONTRAST_CHECKS: Check[] = [
  { label: 'Primary text on panel', fg: 'text', bg: 'panel', min: 4.5 },
  { label: 'Secondary text on panel', fg: 'textMuted', bg: 'panel', min: 4.5 },
  { label: 'Tertiary text on panel', fg: 'textSubtle', bg: 'panel', min: 4.5 },
  { label: 'Accent on panel', fg: 'accent', bg: 'panel', min: 3 },
  { label: 'Positive on panel', fg: 'positive', bg: 'panel', min: 3 },
  { label: 'Negative on panel', fg: 'negative', bg: 'panel', min: 3 },
  { label: 'Text on accent', fg: 'accentContrast', bg: 'accent', min: 4.5 },
];

export function runContrastChecks(tokens: ThemeTokens) {
  return CONTRAST_CHECKS.map((c) => {
    const ratio = contrastRatio(tokens[c.fg], tokens[c.bg]);
    return { ...c, ratio, pass: ratio >= c.min };
  });
}

/** Theme builder: edit every token with a colour picker; changes preview live. */
export default function ThemeBuilder() {
  const builder = useThemeStore((s) => s.builder);
  const closeBuilder = useThemeStore((s) => s.closeBuilder);
  const setDraftToken = useThemeStore((s) => s.setDraftToken);
  const setDraftName = useThemeStore((s) => s.setDraftName);
  const setDraftMode = useThemeStore((s) => s.setDraftMode);
  const saveDraft = useThemeStore((s) => s.saveDraft);
  const notify = useToast();
  const [editing, setEditing] = useState<ThemeTokenKey>('accent');
  const draft = builder.draft;
  const checks = draft ? runContrastChecks(draft.tokens) : [];
  const failing = checks.filter((c) => !c.pass).length;

  return (
    <Drawer
      open={builder.open && draft !== null}
      onClose={closeBuilder}
      title="Theme builder"
      description="Changes preview live across the workstation. Cancel restores the previous theme."
      actions={
        <>
          <Button onClick={closeBuilder}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (saveDraft()) notify({ message: 'Theme saved and applied', tone: 'success' });
            }}
          >
            Save theme
          </Button>
        </>
      }
    >
      {draft ? (
        <div className="flex flex-col gap-4">
          <TextField
            label="Theme name"
            value={draft.name}
            maxLength={40}
            onValueChange={setDraftName}
          />
          <Segmented<'dark' | 'light'>
            label="Base mode"
            hideLabel={false}
            size="sm"
            value={draft.mode}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
            onValueChange={setDraftMode}
          />
          <div className="flex flex-col gap-2 rounded border border-line p-3">
            <p className="text-xs font-medium text-fg">{TOKEN_LABELS[editing]}</p>
            <div className="flex gap-3">
              <HexColorPicker
                color={draft.tokens[editing]}
                onChange={(hex) => setDraftToken(editing, hex)}
                style={{ width: 160, height: 140 }}
              />
              <div className="flex flex-col gap-2">
                <label className="text-2xs text-muted" htmlFor="hex-input">
                  Hex value
                </label>
                <HexColorInput
                  id="hex-input"
                  color={draft.tokens[editing]}
                  onChange={(hex) => setDraftToken(editing, hex)}
                  prefixed
                  className="num h-8 w-28 rounded border border-line-strong bg-bg px-2 text-sm text-fg focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </div>
          <fieldset>
            <legend className="mb-1 text-xs font-medium text-fg">Tokens</legend>
            <div className="grid grid-cols-2 gap-1">
              {THEME_TOKEN_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={editing === key}
                  onClick={() => setEditing(key)}
                  className={cx(
                    'flex items-center gap-2 rounded border px-2 py-1 text-left text-xs',
                    editing === key
                      ? 'border-accent bg-raised'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 rounded-sm border border-line-strong"
                    style={{ background: draft.tokens[key] }}
                  />
                  <span className="flex-1 truncate">{TOKEN_LABELS[key]}</span>
                  <span className="num text-2xs text-subtle">{draft.tokens[key]}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <section aria-labelledby="contrast-heading">
            <h3 id="contrast-heading" className="mb-1 text-xs font-medium text-fg">
              Contrast checks (WCAG 2.x ratio, computed){' '}
              <span className={failing ? 'text-warn' : 'text-pos'}>
                {failing ? `· ${failing} below target` : '· all pass'}
              </span>
            </h3>
            <ul className="flex flex-col gap-0.5 text-xs">
              {checks.map((c) => (
                <li
                  key={c.label}
                  className="flex items-center justify-between border-b border-line py-1"
                >
                  <span className="text-muted">{c.label}</span>
                  <span className={cx('num', c.pass ? 'text-pos' : 'text-warn')}>
                    {c.pass ? '✓' : '!'} {c.ratio.toFixed(2)}:1{' '}
                    <span className="text-subtle">(min {c.min})</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}
