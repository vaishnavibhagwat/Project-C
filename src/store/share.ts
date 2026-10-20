import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { PageSnapshot } from '@/types';
import { sanitizeText } from '@/utils/sanitize';
import { SharePayloadSchema, type SharePayload } from './schemas';

/** Layout JSON budget from the brief. Snapshots never contain datasets, so this is generous. */
export const MAX_LAYOUT_BYTES = 50 * 1024;

export function snapshotBytes(snapshot: PageSnapshot): number {
  return new TextEncoder().encode(JSON.stringify(snapshot)).length;
}

export function encodeShare(snapshot: PageSnapshot, themeId?: string): string {
  const payload: SharePayload = { v: 1, snapshot, themeId };
  const json = JSON.stringify(payload);
  if (new TextEncoder().encode(json).length > MAX_LAYOUT_BYTES) {
    throw new Error('Layout is larger than the 50 KB sharing limit.');
  }
  return compressToEncodedURIComponent(json);
}

export type DecodeResult = { ok: true; payload: SharePayload } | { ok: false; error: string };

/** Decode and validate a shared layout. Untrusted input: decompress, parse, zod, sanitise. */
export function decodeShare(encoded: string): DecodeResult {
  if (encoded.length > 200_000) return { ok: false, error: 'Share link is too long.' };
  const json = decompressFromEncodedURIComponent(encoded);
  if (!json) return { ok: false, error: 'Share link is corrupted or incomplete.' };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Share link does not contain valid JSON.' };
  }
  const parsed = SharePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `Invalid layout${issue ? ` (${issue.path.join('.')}: ${issue.message})` : ''}.`,
    };
  }
  const payload = parsed.data;
  return {
    ok: true,
    payload: {
      ...payload,
      snapshot: {
        ...payload.snapshot,
        instances: payload.snapshot.instances.map((i) => ({
          ...i,
          title: sanitizeText(i.title, 80),
        })),
      },
    },
  };
}

export function buildShareUrl(encoded: string, page: string, base = window.location.href): string {
  const url = new URL(base);
  url.hash = `#/${page}?share=${encoded}`;
  return url.toString();
}
