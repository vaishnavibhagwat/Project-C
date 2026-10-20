import { useCallback, useSyncExternalStore } from 'react';
import type { AppRoute } from '@/types';

const ROUTES: readonly AppRoute[] = [
  'workstation',
  'risk',
  'holdings',
  'performance',
  'research',
  'marketplace',
];

export interface HashLocation {
  route: AppRoute;
  params: URLSearchParams;
}

function isRoute(value: string): value is AppRoute {
  return ROUTES.some((r) => r === value);
}

/** Parse "#/risk?share=..." into a route and query params. Unknown routes fall back. */
export function parseHash(hash: string): HashLocation {
  const raw = hash.replace(/^#\/?/, '');
  const [path = '', query = ''] = raw.split('?');
  return { route: isRoute(path) ? path : 'workstation', params: new URLSearchParams(query) };
}

export function buildHash(route: AppRoute, params?: Record<string, string>): string {
  const query = params ? new URLSearchParams(params).toString() : '';
  return `#/${route}${query ? `?${query}` : ''}`;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

const getHash = () => window.location.hash;

/** Tiny hash router: no dependency, works on static hosting, deep-linkable. */
export function useHashRoute(): HashLocation & {
  navigate: (route: AppRoute, params?: Record<string, string>) => void;
  clearParams: () => void;
} {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  const location = parseHash(hash);
  const navigate = useCallback((route: AppRoute, params?: Record<string, string>) => {
    window.location.hash = buildHash(route, params);
  }, []);
  const clearParams = useCallback(() => {
    const { route } = parseHash(window.location.hash);
    window.history.replaceState(null, '', buildHash(route));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, []);
  return { ...location, navigate, clearParams };
}
