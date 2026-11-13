import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { MAX_LAYOUT_BYTES } from '@/store/share';
import {
  fromJSON,
  serializedBytes,
  toDocument,
  type DashboardState,
  type FromJsonResult,
} from './LayoutSerializer';

/**
 * Read-only share links: the layout document (LayoutSerializer, compact JSON) compressed with
 * lz-string into `#/shared?layout=…`. Opening one validates it exactly like an imported file and
 * shows it read-only, with "Save a copy". Nothing in the link is applied to the user's pages.
 */

/** Longest `layout` parameter accepted (a 50 KB document compresses to far less). */
export const MAX_LINK_PARAM = 120_000;

export function encodeLayoutLink(state: DashboardState, now = Date.now()): string {
  const json = JSON.stringify(toDocument(state, now));
  if (serializedBytes(json) > MAX_LAYOUT_BYTES) {
    throw new Error(`Layout is larger than the ${MAX_LAYOUT_BYTES / 1024} KB sharing limit.`);
  }
  return compressToEncodedURIComponent(json);
}

export function decodeLayoutLink(encoded: string): FromJsonResult {
  if (encoded.length > MAX_LINK_PARAM) {
    return { ok: false, error: 'This share link is too long.', issues: [] };
  }
  const json = decompressFromEncodedURIComponent(encoded);
  if (!json) return { ok: false, error: 'This share link is corrupted or incomplete.', issues: [] };
  return fromJSON(json);
}

/** Absolute URL of the read-only view for an encoded layout. */
export function buildLayoutLinkUrl(encoded: string, base = window.location.href): string {
  const url = new URL(base);
  url.hash = `#/shared?layout=${encoded}`;
  return url.toString();
}
