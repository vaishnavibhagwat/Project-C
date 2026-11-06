import { useId, useState } from 'react';
import { Segmented } from '@/components/FormControls';
import { IconInfo } from '@/components/Icons';
import { useDashboardStore } from '@/store/dashboardStore';
import type { RiskSettings } from '@/store/schemas';
import { cx } from '@/utils/cx';

/** What the Risk page's numbers assume (also in docs/ASSUMPTIONS.md §7 and §21). */
export const RISK_ASSUMPTIONS: readonly string[] = [
  'VaR: 1-day historical simulation and parametric (normal) VaR from the last 252 daily returns of the NAV derived from the holdings. 99% / 1-day is the default, as SEBI uses.',
  '10-day VaR scales the 1-day figure by √10 (square-root-of-time). This assumes independent, identically distributed returns: an approximation that understates risk when losses cluster.',
  'Stress scenarios are instantaneous, first-order shocks to today’s positions: equities by beta to the Nifty 50, bonds by approximate modified duration, USD assets by the FX move. No second-order (convexity, gamma) or liquidity effects.',
  'Risk contribution splits portfolio volatility across positions (Euler allocation on the 252-day covariance of daily position P&L); contributions add up to the total, and diversifiers are negative.',
  'Exposure: futures at full notional, options at delta-adjusted notional, everything else at market value.',
  'All data is simulated from one seeded portfolio model; nothing here is a real market quote.',
];

/**
 * The Risk Analytics page's controls: VaR confidence (95/99%) and horizon (1/10 day) for every
 * risk widget on the page, and the page's assumptions.
 */
export function RiskControls() {
  const settings = useDashboardStore((s) => s.riskSettings);
  const setRiskSettings = useDashboardStore((s) => s.setRiskSettings);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <section
      aria-label="Risk settings"
      className="mb-2 rounded border border-line bg-panel px-3 py-2 text-xs"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted">
          Page settings
        </span>
        <Segmented<RiskSettings['confidence']>
          label="VaR confidence"
          value={settings.confidence}
          options={[
            { value: '95', label: '95%' },
            { value: '99', label: '99%' },
          ]}
          onValueChange={(confidence) => setRiskSettings({ confidence })}
        />
        <Segmented<'1' | '10'>
          label="VaR horizon"
          value={settings.horizonDays === 10 ? '10' : '1'}
          options={[
            { value: '1', label: '1 day' },
            { value: '10', label: '10 days' },
          ]}
          onValueChange={(h) => setRiskSettings({ horizonDays: h === '10' ? 10 : 1 })}
        />
        <span className="text-muted">Applied to VaR and risk contribution on this page.</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className={cx(
            'ml-auto flex items-center gap-1 rounded border px-2 py-0.5 hover:bg-raised',
            open ? 'border-accent text-fg' : 'border-line text-muted',
          )}
        >
          <IconInfo size={13} aria-hidden="true" />
          Assumptions
        </button>
      </div>
      {open ? (
        <ul id={panelId} className="mt-2 list-disc space-y-1 pl-5 text-muted">
          {RISK_ASSUMPTIONS.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
