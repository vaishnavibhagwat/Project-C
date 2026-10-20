import { createContext, useContext } from 'react';

export interface SymbolDetailApi {
  /** Open the detail panel for an NSE symbol (holding or Nifty 50 constituent). */
  openSymbol: (symbol: string) => void;
}

export const SymbolDetailContext = createContext<SymbolDetailApi | null>(null);

/** Returns null outside the app shell (e.g. isolated stories), so callers can hide the action. */
export function useSymbolDetail(): SymbolDetailApi | null {
  return useContext(SymbolDetailContext);
}
