import { fixture } from '@/__tests__/fixtures';
import type { SectorHeatmapConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('market/sector-returns');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: SectorHeatmapConfig = {
  days: '5',
  sortBy: 'name',
  showValues: true,
  capPct: 1,
};
