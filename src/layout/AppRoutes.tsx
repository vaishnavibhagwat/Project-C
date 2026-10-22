import { lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { routePath } from '@/hooks/useAppRoute';
import { AppShell } from './AppShell';

// Each page is its own chunk; AppShell shows a skeleton while one loads.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const HOME = routePath('workstation');

/**
 * Route table. Static paths win over the dashboard parameter, so /marketplace and /settings
 * never reach DashboardPage; DashboardPage redirects unknown page ids.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={HOME} replace />} />
        <Route path="marketplace" element={<MarketplacePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path=":pageId" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to={HOME} replace />} />
      </Route>
    </Routes>
  );
}

/**
 * Hash routing: works on any static host without server rewrites, and share links keep the
 * "#/<page>?share=…" form.
 */
export function AppRouter() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
