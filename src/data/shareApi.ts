import { z } from 'zod';
import { env } from '@/utils/env';
import { toIstIso } from '@/utils/time';
import { ApiError, ValidationError } from './api';

/**
 * Mock layout-sharing API: `POST /api/layouts/share`. Like the rest of the mock back end it
 * answers in the browser (simulated latency, no network). Shares are kept in memory for the
 * session; the users are fictional colleagues on the same desk.
 */

export const SHARE_ENDPOINT = 'layouts/share';

export interface SimulatedUser {
  id: string;
  name: string;
  role: string;
}

/** Fictional colleagues a layout can be shared with. */
export const SIMULATED_USERS: readonly SimulatedUser[] = [
  { id: 'u-arjun', name: 'Arjun Mehta', role: 'Portfolio Manager, Equities' },
  { id: 'u-priya', name: 'Priya Nair', role: 'Risk Analyst' },
  { id: 'u-kabir', name: 'Kabir Shah', role: 'Fixed Income Trader' },
  { id: 'u-meera', name: 'Meera Iyer', role: 'Chief Investment Officer' },
  { id: 'u-rohan', name: 'Rohan Das', role: 'Compliance (view only)' },
];

export const SharePermissionSchema = z.enum(['readonly', 'editable']);
export type SharePermission = z.infer<typeof SharePermissionSchema>;

/** Request body. Unknown keys are refused. */
export const ShareRequestSchema = z
  .object({
    layoutId: z.string().min(1).max(80),
    targetUserId: z.string().min(1).max(40),
    permission: SharePermissionSchema,
  })
  .strict();
export type ShareRequest = z.infer<typeof ShareRequestSchema>;

export const LayoutShareSchema = ShareRequestSchema.extend({
  shareId: z.string().min(1),
  createdAt: z.string(),
});
export type LayoutShare = z.infer<typeof LayoutShareSchema>;

let shares: LayoutShare[] = [];
let counter = 0;

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/**
 * POST /api/layouts/share. Validates the body, checks the user exists, and stores the share
 * (sharing the same layout with the same user again updates the permission).
 */
export async function postLayoutShare(
  body: unknown,
  { latencyMs = env.VITE_API_LATENCY_MS, now = Date.now } = {},
): Promise<LayoutShare> {
  await wait(latencyMs);
  const parsed = ShareRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(
      `400 Bad Request: ${issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'invalid body'}`,
    );
  }
  const request = parsed.data;
  if (!SIMULATED_USERS.some((u) => u.id === request.targetUserId)) {
    throw new ApiError(`404 Not Found: no user ${request.targetUserId}`);
  }
  const existing = shares.find(
    (s) => s.layoutId === request.layoutId && s.targetUserId === request.targetUserId,
  );
  counter += 1;
  const share = LayoutShareSchema.parse({
    ...request,
    shareId: existing?.shareId ?? `share-${counter}`,
    createdAt: toIstIso(now()),
  });
  shares = [...shares.filter((s) => s.shareId !== share.shareId), share];
  return share;
}

/** Shares of one layout, oldest first. */
export function listLayoutShares(layoutId: string): LayoutShare[] {
  return shares.filter((s) => s.layoutId === layoutId);
}

/** Tests: forget every share. */
export function resetLayoutShares(): void {
  shares = [];
  counter = 0;
}
