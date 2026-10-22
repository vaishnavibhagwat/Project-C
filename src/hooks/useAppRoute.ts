import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { AppRoute, PageId } from '@/types';

/** Dashboard pages, in navigation order. */
export const PAGE_ROUTES: readonly PageId[] = [
  'workstation',
  'risk',
  'holdings',
  'performance',
  'research',
];

export const APP_ROUTES: readonly AppRoute[] = [...PAGE_ROUTES, 'marketplace', 'settings'];

export function isPageRoute(route: AppRoute | null): route is PageId {
  return PAGE_ROUTES.some((p) => p === route);
}

/** The app route for a router pathname ("/risk" → "risk"), or null if it is not one. */
export function routeFromPath(pathname: string): AppRoute | null {
  const segment = pathname.replace(/^\/+/, '').split('/')[0] ?? '';
  return APP_ROUTES.find((r) => r === segment) ?? null;
}

/** Router path for a route, with optional query parameters ("/marketplace?target=risk"). */
export function routePath(route: AppRoute, params?: Record<string, string>): string {
  const query = params ? new URLSearchParams(params).toString() : '';
  return `/${route}${query ? `?${query}` : ''}`;
}

export interface AppRouteApi {
  /** Current route, or null while an unknown path is being redirected. */
  route: AppRoute | null;
  params: URLSearchParams;
  navigate: (route: AppRoute, params?: Record<string, string>) => void;
  /** Drop query parameters (e.g. ?share=…) without adding a history entry. */
  clearParams: () => void;
}

/**
 * App routing on top of react-router (HashRouter, so links work on static hosting and share
 * links look like "#/risk?share=…"). Pages use this instead of the router hooks directly.
 */
export function useAppRoute(): AppRouteApi {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const routerNavigate = useNavigate();
  const route = routeFromPath(location.pathname);
  const navigate = useCallback(
    (to: AppRoute, query?: Record<string, string>) => routerNavigate(routePath(to, query)),
    [routerNavigate],
  );
  const clearParams = useCallback(() => setParams({}, { replace: true }), [setParams]);
  return useMemo(
    () => ({ route, params, navigate, clearParams }),
    [route, params, navigate, clearParams],
  );
}
