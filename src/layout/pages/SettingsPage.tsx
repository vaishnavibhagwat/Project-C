import { useState, type ReactNode } from 'react';
import { Button } from '@/components/Button';
import { Segmented, SelectField, Switch, TextField } from '@/components/FormControls';
import { IconPalette, IconRotate } from '@/components/Icons';
import { Modal } from '@/components/Overlay';
import { Tabs } from '@/components/Tabs';
import { useToast } from '@/components/Toast';
import { setSimulatedOutage } from '@/data/connection';
import { useConnection } from '@/hooks/useConnection';
import { PAGES } from '@/registry/pages';
import { applyGridConfig, resetPage } from '@/store/actions';
import { useDashboardStore, type DisplayCurrency } from '@/store/dashboardStore';
import { useLayoutStore } from '@/store/layoutStore';
import { allThemes, useThemeStore } from '@/store/themeStore';
import type { GridCompaction, GridConfig } from '@/types';
import { env } from '@/utils/env';
import { columnsFor, DEFAULT_GRID_CONFIG, GRID_BREAKPOINTS, GRID_LIMITS } from '@/utils/gridLayout';
import { ShortcutsList } from '../ShortcutsList';

type Section = 'grid' | 'appearance' | 'data' | 'workspace' | 'shortcuts';
type NumericKey = 'cols' | 'rowHeight' | 'gap';

const FIELDS: { key: NumericKey; label: string; unit: string }[] = [
  { key: 'cols', label: 'Desktop columns', unit: '' },
  { key: 'rowHeight', label: 'Row height', unit: 'px' },
  { key: 'gap', label: 'Gap', unit: 'px' },
];

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded border border-line bg-panel p-3">
      <h2 className="text-2xs font-semibold uppercase tracking-wide text-subtle">{title}</h2>
      {children}
    </section>
  );
}

function fieldError(raw: string, limits: { min: number; max: number }): string | null {
  const n = Number(raw);
  if (raw.trim() === '' || !Number.isInteger(n)) {
    return `Enter a whole number from ${limits.min} to ${limits.max}.`;
  }
  if (n < limits.min || n > limits.max) return `Allowed range is ${limits.min} to ${limits.max}.`;
  return null;
}

/** Draft form for grid settings; Apply converts every page's layout once. */
function GridSettingsForm({ grid }: { grid: GridConfig }) {
  const notify = useToast();
  const [draft, setDraft] = useState<Record<NumericKey, string>>({
    cols: String(grid.cols),
    rowHeight: String(grid.rowHeight),
    gap: String(grid.gap),
  });
  const [compaction, setCompaction] = useState<GridCompaction>(grid.compaction);
  const errors = Object.fromEntries(
    FIELDS.map((f) => [f.key, fieldError(draft[f.key], GRID_LIMITS[f.key])]),
  );
  const valid = FIELDS.every((f) => errors[f.key] === null);
  const next: GridConfig = {
    cols: Number(draft.cols),
    rowHeight: Number(draft.rowHeight),
    gap: Number(draft.gap),
    compaction,
  };
  const changed =
    next.cols !== grid.cols ||
    next.rowHeight !== grid.rowHeight ||
    next.gap !== grid.gap ||
    next.compaction !== grid.compaction;
  const cols = columnsFor(valid ? next : grid);

  const apply = (config: GridConfig, message: string) => {
    if (applyGridConfig(config)) notify({ message, tone: 'success' });
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && changed) apply(next, 'Grid settings applied to every page');
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <TextField
            key={f.key}
            type="number"
            inputMode="numeric"
            label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`}
            description={`${GRID_LIMITS[f.key].min} to ${GRID_LIMITS[f.key].max}`}
            min={GRID_LIMITS[f.key].min}
            max={GRID_LIMITS[f.key].max}
            step={1}
            value={draft[f.key]}
            error={errors[f.key]}
            onValueChange={(value) => setDraft((d) => ({ ...d, [f.key]: value }))}
          />
        ))}
      </div>
      <Segmented<GridCompaction>
        label="Compaction"
        hideLabel={false}
        size="sm"
        value={compaction}
        options={[
          { value: 'vertical', label: 'Vertical' },
          { value: 'none', label: 'None' },
        ]}
        onValueChange={setCompaction}
      />
      <p className="num text-xs text-muted">
        Desktop (≥{GRID_BREAKPOINTS.desktop} px) {cols.desktop} columns · tablet (≥
        {GRID_BREAKPOINTS.tablet} px) {cols.tablet} · mobile {cols.mobile}, stacked. Each keeps its
        own layout. Applying converts every page so widgets keep their proportions.
      </p>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={!valid || !changed}>
          Apply
        </Button>
        <Button
          size="sm"
          icon={IconRotate}
          onClick={() => apply(DEFAULT_GRID_CONFIG, 'Grid settings reset to defaults')}
        >
          Reset to defaults
        </Button>
      </div>
    </form>
  );
}

function GridSection() {
  const grid = useDashboardStore((s) => s.gridConfig);
  // Re-key on the stored settings so the draft starts fresh after Apply or Reset.
  const key = `${grid.cols}-${grid.rowHeight}-${grid.gap}-${grid.compaction}`;
  return (
    <SettingsGroup title="Dashboard grid">
      <GridSettingsForm key={key} grid={grid} />
    </SettingsGroup>
  );
}

function AppearanceSection() {
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const customThemes = useThemeStore((s) => s.customThemes);
  const setActiveTheme = useThemeStore((s) => s.setActiveTheme);
  const openBuilder = useThemeStore((s) => s.openBuilder);
  const currency = useDashboardStore((s) => s.displayCurrency);
  const setCurrency = useDashboardStore((s) => s.setDisplayCurrency);
  return (
    <div className="flex flex-col gap-3">
      <SettingsGroup title="Theme">
        <SelectField
          label="Theme"
          value={activeThemeId}
          options={allThemes(customThemes).map((t) => ({
            value: t.id,
            label: `${t.name}${t.builtIn ? '' : ' (custom)'}`,
          }))}
          onValueChange={setActiveTheme}
        />
        <div>
          <Button size="sm" icon={IconPalette} onClick={() => openBuilder()}>
            Customise theme…
          </Button>
        </div>
      </SettingsGroup>
      <SettingsGroup title="Display">
        <Segmented<DisplayCurrency>
          label="AUM chip currency"
          hideLabel={false}
          size="sm"
          value={currency}
          options={[
            { value: 'INR', label: 'INR' },
            { value: 'USD', label: 'USD' },
          ]}
          onValueChange={setCurrency}
        />
      </SettingsGroup>
    </div>
  );
}

function DataSection() {
  const connection = useConnection();
  const facts: [string, string][] = [
    ['Mock API latency', `${env.VITE_API_LATENCY_MS} ms × widget latency profile (0.4 / 1 / 2.5)`],
    ['Simulated error rate', `${Math.round(env.VITE_MOCK_ERROR_RATE * 100)}% of requests`],
    ['Price tick', `every ${env.VITE_TICK_INTERVAL_MS / 1000} s`],
    ['Default refresh', `every ${env.VITE_DATA_REFRESH_INTERVAL / 1000} s`],
    [
      'Outside NSE hours',
      env.VITE_SIMULATE_MARKET_OPEN ? 'simulated ticks continue' : 'prices hold at the close',
    ],
    ['Dataset seed', String(env.VITE_DATA_SEED)],
  ];
  return (
    <div className="flex flex-col gap-3">
      <SettingsGroup title="Data feed (simulated)">
        <Switch
          label="Simulate feed outage"
          description="Disconnects the simulated feed so every widget shows its disconnected state."
          checked={connection.simulatedOutage}
          onCheckedChange={setSimulatedOutage}
        />
      </SettingsGroup>
      <SettingsGroup title="Simulation settings (.env, read-only)">
        <dl className="num grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          {facts.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-muted">{term}</dt>
              <dd className="text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      </SettingsGroup>
    </div>
  );
}

function WorkspaceSection() {
  const notify = useToast();
  const locked = useDashboardStore((s) => s.locked);
  const setLocked = useDashboardStore((s) => s.setLocked);
  const savedCount = useLayoutStore((s) => s.savedLayouts.length);
  const shareCount = useLayoutStore((s) => s.shares.length);
  const clearShares = useLayoutStore((s) => s.clearShares);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <SettingsGroup title="Layout">
        <Switch
          label="Lock layout"
          description="Stops widgets from being dragged or resized (shortcut L)."
          checked={locked}
          onCheckedChange={setLocked}
        />
      </SettingsGroup>
      <SettingsGroup title="Stored in this browser">
        <p className="num text-xs text-muted">
          {savedCount} saved layout{savedCount === 1 ? '' : 's'} · {shareCount} recent share link
          {shareCount === 1 ? '' : 's'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={shareCount === 0}
            onClick={() => {
              clearShares();
              notify({ message: 'Share history cleared' });
            }}
          >
            Clear share history
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmReset(true)}>
            Reset all dashboards…
          </Button>
        </div>
      </SettingsGroup>
      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all dashboards?"
        description="Every dashboard returns to its default widgets, settings and layout."
        actions={
          <>
            <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                for (const page of PAGES) resetPage(page.id);
                setConfirmReset(false);
                notify({ message: 'All dashboards reset to default', tone: 'success' });
              }}
            >
              Reset all
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Saved layouts are kept and can be loaded again.</p>
      </Modal>
    </div>
  );
}

/** Settings: grid, appearance, data feed, workspace and keyboard shortcuts. */
export default function SettingsPage() {
  const [section, setSection] = useState<Section>('grid');
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <header>
        <h1 className="text-lg font-semibold text-fg">Settings</h1>
        <p className="text-xs text-muted">
          Preferences are saved in this browser. Every value on the dashboards is simulated.
        </p>
      </header>
      <Tabs<Section>
        label="Settings sections"
        value={section}
        onValueChange={setSection}
        items={[
          { value: 'grid', label: 'Grid', content: <GridSection /> },
          { value: 'appearance', label: 'Appearance', content: <AppearanceSection /> },
          { value: 'data', label: 'Data feed', content: <DataSection /> },
          { value: 'workspace', label: 'Workspace', content: <WorkspaceSection /> },
          {
            value: 'shortcuts',
            label: 'Shortcuts',
            content: (
              <SettingsGroup title="Keyboard shortcuts">
                <ShortcutsList />
              </SettingsGroup>
            ),
          },
        ]}
      />
    </div>
  );
}
