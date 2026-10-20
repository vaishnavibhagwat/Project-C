import type { ComponentType } from 'react';
import {
  IconGrid,
  IconLayers,
  IconNews,
  IconShield,
  IconStore,
  IconTrendingUp,
  type IconProps,
} from '@/components/Icons';
import { buildHash } from '@/hooks/useHashRoute';
import type { AppRoute } from '@/types';
import { cx } from '@/utils/cx';

export interface NavItem {
  route: AppRoute;
  label: string;
  icon: ComponentType<IconProps>;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { route: 'workstation', label: 'Portfolio Workstation', icon: IconGrid },
  { route: 'risk', label: 'Risk Analytics', icon: IconShield },
  { route: 'holdings', label: 'Holdings Explorer', icon: IconLayers },
  { route: 'performance', label: 'Performance & Attribution', icon: IconTrendingUp },
  { route: 'research', label: 'Research & Alerts', icon: IconNews },
  { route: 'marketplace', label: 'Widget Marketplace', icon: IconStore },
];

/** Slim icon navigation rail. Labels appear on hover/focus and are the accessible names. */
export function NavRail({ active }: { active: AppRoute }) {
  return (
    <nav
      aria-label="Primary"
      className="flex w-14 shrink-0 flex-col items-center border-r border-line bg-panel py-2"
    >
      <a
        href={buildHash('workstation')}
        className="mb-3 flex h-8 w-8 items-center justify-center rounded bg-accent text-sm font-bold text-accent-fg"
        aria-label="Meridian Capital home"
      >
        M
      </a>
      <ul className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item, index) => {
          const current = item.route === active;
          const Icon = item.icon;
          return (
            <li
              key={item.route}
              className={cx(index === NAV_ITEMS.length - 1 && 'mt-3 border-t border-line pt-3')}
            >
              <a
                href={buildHash(item.route)}
                aria-current={current ? 'page' : undefined}
                aria-label={item.label}
                className={cx(
                  'group relative flex h-9 w-9 items-center justify-center rounded transition-colors',
                  current ? 'bg-raised text-accent' : 'text-muted hover:bg-raised hover:text-fg',
                )}
              >
                {current ? (
                  <span
                    aria-hidden="true"
                    className="absolute -left-2.5 h-5 w-0.5 rounded-r bg-accent"
                  />
                ) : null}
                <Icon size={18} />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-11 z-50 hidden whitespace-nowrap rounded border border-line-strong bg-raised px-2 py-1 text-xs text-fg shadow-lg group-hover:block group-focus-visible:block"
                >
                  {item.label}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
