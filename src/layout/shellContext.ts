import { useOutletContext } from 'react-router-dom';
import type { PageId } from '@/types';

/** What the app shell shares with the routed pages (via the router's Outlet context). */
export interface ShellContext {
  /** The dashboard shown most recently, for pages that act on "the current dashboard". */
  lastPage: PageId;
  openLayouts: () => void;
}

export function useShellContext(): ShellContext {
  return useOutletContext<ShellContext>();
}
