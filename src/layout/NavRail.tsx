import type { ComponentType } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  IconGrid,
  IconLayers,
  IconNews,
  IconSettings,
  IconShield,
  IconStore,
  IconTrendingUp,
  type IconProps,
} from '@/components/Icons';
import { Tooltip } from '@/components/Tooltip';
import { routePath } from '@/hooks/useAppRoute';
import type { AppRoute } from '@/types';
import { cx } from '@/utils/cx';

export interface NavItem {
  route: AppRoute;
  label: string;
  icon: ComponentType<IconProps>;
}

/** Dashboards first, then tools. Order also drives the "G then 1-7" shortcuts. */
export const NAV_ITEMS: readonly NavItem[] = [
  { route: 'workstation', label: 'Workstation', icon: IconGrid },
  { route: 'risk', label: 'Risk', icon: IconShield },
  { route: 'holdings', label: 'Holdings', icon: IconLayers },
  { route: 'performance', label: 'Performance', icon: IconTrendingUp },
  { route: 'research', label: 'Research & Alerts', icon: IconNews },
  { route: 'marketplace', label: 'Marketplace', icon: IconStore },
  { route: 'settings', label: 'Settings', icon: IconSettings },
];

const TOOLS: ReadonlySet<AppRoute> = new Set<AppRoute>(['marketplace', 'settings']);

function RailLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Tooltip content={item.label} side="right" decorative>
      {(tip) => (
        <NavLink
          to={routePath(item.route)}
          aria-label={item.label}
          {...tip}
          className={({ isActive }) =>
            cx(
              'relative flex h-9 w-9 items-center justify-center rounded transition-colors',
              isActive ? 'bg-raised text-accent' : 'text-muted hover:bg-raised hover:text-fg',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute -left-2.5 h-5 w-0.5 rounded-r bg-accent"
                />
              ) : null}
              <Icon size={18} />
            </>
          )}
        </NavLink>
      )}
    </Tooltip>
  );
}

/** Slim icon navigation rail. Each link's label is its accessible name and its tooltip. */
export function NavRail() {
  const pages = NAV_ITEMS.filter((item) => !TOOLS.has(item.route));
  const tools = NAV_ITEMS.filter((item) => TOOLS.has(item.route));
  return (
    <nav
      aria-label="Primary"
      className="flex w-14 shrink-0 flex-col items-center border-r border-line bg-panel py-2"
    >
      <Link
        to={routePath('workstation')}
        className="mb-3 flex h-8 w-8 items-center justify-center rounded bg-accent text-sm font-bold text-accent-fg"
        aria-label="Meridian Capital home"
      >
        M
      </Link>
      <ul className="flex flex-1 flex-col gap-1">
        {pages.map((item) => (
          <li key={item.route}>
            <RailLink item={item} />
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-1 border-t border-line pt-2">
        {tools.map((item) => (
          <li key={item.route}>
            <RailLink item={item} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
