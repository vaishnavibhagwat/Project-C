import { useState } from 'react';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/FormControls';
import { IconUser } from '@/components/Icons';
import { Modal } from '@/components/Overlay';
import { Popover } from '@/components/Popover';
import { useToast } from '@/components/Toast';
import { PAGES } from '@/registry/pages';
import { resetPage } from '@/store/actions';
import { useDashboardStore, type DisplayCurrency } from '@/store/dashboardStore';
import { ShortcutsList } from './ShortcutsList';

/** User menu: display preference, shortcuts, workspace reset and the about/honesty notes. */
export function UserMenu() {
  const currency = useDashboardStore((s) => s.displayCurrency);
  const setCurrency = useDashboardStore((s) => s.setDisplayCurrency);
  const notify = useToast();
  const [dialog, setDialog] = useState<'shortcuts' | 'about' | 'reset' | null>(null);

  return (
    <>
      <Popover
        label="User menu"
        width="w-64"
        trigger={(props) => (
          <button
            type="button"
            {...props}
            aria-label="User menu"
            className="flex h-8 items-center gap-2 rounded px-1.5 hover:bg-raised"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-raised text-2xs font-semibold text-fg">
              <IconUser size={14} />
            </span>
            <span className="hidden text-left leading-tight xl:block">
              <span className="block text-xs text-fg">Portfolio Manager</span>
              <span className="block text-2xs text-subtle">Mumbai desk (demo)</span>
            </span>
          </button>
        )}
      >
        {(close) => (
          <div className="flex flex-col gap-1 p-2 text-sm">
            <div className="flex items-center justify-between px-1 py-1">
              <span className="text-xs text-muted">AUM chip currency</span>
              <Segmented<DisplayCurrency>
                label="AUM chip currency"
                value={currency}
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'INR', label: 'INR' },
                ]}
                onValueChange={setCurrency}
              />
            </div>
            <div className="border-t border-line pt-1">
              {(
                [
                  ['shortcuts', 'Keyboard shortcuts'],
                  ['about', 'About this demo'],
                  ['reset', 'Reset workspace…'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-raised"
                  onClick={() => {
                    setDialog(key);
                    close();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Popover>

      <Modal
        open={dialog === 'shortcuts'}
        onClose={() => setDialog(null)}
        title="Keyboard shortcuts"
      >
        <ShortcutsList />
      </Modal>

      <Modal open={dialog === 'about'} onClose={() => setDialog(null)} title="About this demo">
        <div className="flex flex-col gap-2 text-sm text-muted">
          <p>
            Meridian Capital is a fictional asset manager. Every number on screen is{' '}
            <strong className="text-fg">simulated</strong> from one seeded, deterministic dataset;
            nothing is live market data and nothing is investment advice.
          </p>
          <p>
            Prices follow geometric Brownian motion; AUM is fixed at exactly USD 45.0B at the last
            close and converted at a fixed, configured USD/INR rate. Research items are sample
            content.
          </p>
          <p>
            Risk and attribution figures use textbook formulas with documented simplifications (see
            the info icons and docs/ASSUMPTIONS.md). They are not institutional-grade calculations.
          </p>
        </div>
      </Modal>

      <Modal
        open={dialog === 'reset'}
        onClose={() => setDialog(null)}
        title="Reset workspace?"
        description="Restores the default widgets and layout on every page. Saved layouts and themes are kept."
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                for (const p of PAGES) resetPage(p.id);
                setDialog(null);
                notify({ message: 'Workspace reset to defaults', tone: 'success' });
              }}
            >
              Reset all pages
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          This cannot be undone, but you can save the current layout first from the Layouts panel.
        </p>
      </Modal>
    </>
  );
}
