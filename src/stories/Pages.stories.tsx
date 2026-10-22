import type { Meta, StoryObj } from '@storybook/react';
import { Outlet, Route, Routes } from 'react-router-dom';
import DashboardPage from '@/layout/pages/DashboardPage';
import MarketplacePage from '@/layout/pages/MarketplacePage';
import SettingsPage from '@/layout/pages/SettingsPage';
import type { ShellContext } from '@/layout/shellContext';
import { fixtureFetcher, WithFetcher } from './helpers';

const shell: ShellContext = { lastPage: 'workstation', openLayouts: () => undefined };

/** The routed pages without the shell, served from fixtures. `parameters.route` picks one. */
function PageHost() {
  return (
    <WithFetcher fetcher={fixtureFetcher}>
      <div className="p-3">
        <Routes>
          <Route element={<Outlet context={shell} />}>
            <Route path="marketplace" element={<MarketplacePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path=":pageId" element={<DashboardPage />} />
          </Route>
        </Routes>
      </div>
    </WithFetcher>
  );
}

const meta = {
  title: 'Layout/Pages',
  component: PageHost,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PageHost>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Workstation: Portfolio Summary Strip above the widget grid. */
export const Workstation: Story = { parameters: { route: '/workstation' } };
export const Risk: Story = { parameters: { route: '/risk' } };
export const Marketplace: Story = { parameters: { route: '/marketplace' } };
export const Settings: Story = { parameters: { route: '/settings' } };
