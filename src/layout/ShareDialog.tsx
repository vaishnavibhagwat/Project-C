import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Segmented, SelectField } from '@/components/FormControls';
import { IconCopy } from '@/components/Icons';
import { Modal } from '@/components/Overlay';
import {
  listLayoutShares,
  postLayoutShare,
  SIMULATED_USERS,
  type LayoutShare,
  type SharePermission,
} from '@/data/shareApi';
import type { PageMeta } from '@/registry/pages';
import { useLayoutStore } from '@/store/layoutStore';
import { useThemeStore } from '@/store/themeStore';
import { toIstIso } from '@/utils/time';
import { captureDashboard } from './layoutFile';
import { buildLayoutLinkUrl, encodeLayoutLink } from './shareLink';

const PERMISSIONS: { value: SharePermission; label: string }[] = [
  { value: 'readonly', label: 'Read-only' },
  { value: 'editable', label: 'Can edit' },
];

const userName = (id: string) => SIMULATED_USERS.find((u) => u.id === id)?.name ?? id;

/** Share with a (simulated) colleague through the mock API: POST /api/layouts/share. */
function ShareWithUser({ page }: { page: PageMeta }) {
  const active = useLayoutStore((s) =>
    s.savedLayouts.find((l) => l.id === s.activeByPage[page.id]),
  );
  const [userId, setUserId] = useState(SIMULATED_USERS[0]?.id ?? '');
  const [permission, setPermission] = useState<SharePermission>('readonly');
  const [shares, setShares] = useState<LayoutShare[]>(() =>
    active ? listLayoutShares(active.id) : [],
  );
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'error'; message?: string }>({
    kind: 'idle',
  });

  if (!active) {
    return (
      <p className="text-xs text-muted">
        Save this page as a layout first (Save in the page toolbar): sharing is per saved layout.
      </p>
    );
  }

  const share = async () => {
    setState({ kind: 'sending' });
    try {
      await postLayoutShare({ layoutId: active.id, targetUserId: userId, permission });
      setShares(listLayoutShares(active.id));
      setState({ kind: 'idle' });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Share failed.' });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">
        Sharing <strong className="text-fg">{active.name}</strong> (simulated colleagues; the share
        is recorded by the mock API for this session).
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <SelectField
            label="Colleague"
            value={userId}
            options={SIMULATED_USERS.map((u) => ({ value: u.id, label: `${u.name} · ${u.role}` }))}
            onValueChange={setUserId}
          />
        </div>
        <Segmented<SharePermission>
          label="Permission"
          value={permission}
          options={PERMISSIONS}
          onValueChange={setPermission}
        />
        <Button variant="primary" loading={state.kind === 'sending'} onClick={() => void share()}>
          Share
        </Button>
      </div>
      {state.kind === 'error' ? (
        <p role="alert" className="text-xs text-neg">
          {state.message}
        </p>
      ) : null}
      <ul aria-label="Shared with" className="flex flex-col gap-1 text-xs">
        {shares.length === 0 ? (
          <li className="text-muted">Not shared with anyone yet.</li>
        ) : (
          shares.map((s) => (
            <li key={s.shareId} className="flex justify-between gap-2">
              <span className="text-fg">{userName(s.targetUserId)}</span>
              <span className="text-muted">
                {s.permission === 'readonly' ? 'Read-only' : 'Can edit'}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** A read-only link: the layout document compressed into #/shared?layout=…. */
function ShareLink({ page }: { page: PageMeta }) {
  const themeId = useThemeStore((s) => s.activeThemeId);
  const recordShare = useLayoutStore((s) => s.recordShare);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const result = useMemo(() => {
    try {
      const encoded = encodeLayoutLink(captureDashboard(page.id));
      return { ok: true as const, url: buildLayoutLinkUrl(encoded), encodedLength: encoded.length };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : 'Could not create link.',
      };
    }
    // The link includes the theme, so it is rebuilt when the theme changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id, themeId]);

  if (!result.ok) return <p className="text-sm text-neg">{result.error}</p>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.url);
      recordShare({
        page: page.id,
        url: result.url,
        bytes: result.encodedLength,
        createdAt: toIstIso(Date.now()),
      });
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="share-url">
        Read-only link
        <textarea
          id="share-url"
          readOnly
          value={result.url}
          rows={3}
          onFocus={(e) => e.currentTarget.select()}
          className="num w-full resize-none rounded border border-line-strong bg-bg p-2 text-2xs text-fg focus:border-accent focus:outline-none"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button icon={IconCopy} onClick={() => void copy()}>
          Copy link
        </Button>
        <span role="status" className="text-xs text-muted">
          {copied === 'copied'
            ? 'Copied to clipboard.'
            : copied === 'failed'
              ? 'Clipboard unavailable: select the text and copy it.'
              : ''}
        </span>
      </div>
      <p className="num text-2xs text-subtle">
        Opens read-only with a “Save a copy” button. {result.encodedLength.toLocaleString('en-IN')}{' '}
        characters (lz-string).
      </p>
    </div>
  );
}

/** Share a page layout: with a simulated colleague (mock API), or as a read-only link. */
export function ShareDialog({
  open,
  onClose,
  page,
}: {
  open: boolean;
  onClose: () => void;
  page: PageMeta;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Share layout · ${page.short}`}
      description="Layouts carry positions and widget settings only. Recipients see their own simulated data."
    >
      {open ? (
        <div className="flex flex-col gap-4">
          <section aria-labelledby="share-user-heading" className="flex flex-col gap-2">
            <h3 id="share-user-heading" className="text-xs font-semibold uppercase text-muted">
              With a colleague
            </h3>
            <ShareWithUser page={page} />
          </section>
          <section
            aria-labelledby="share-link-heading"
            className="flex flex-col gap-2 border-t border-line pt-3"
          >
            <h3 id="share-link-heading" className="text-xs font-semibold uppercase text-muted">
              Link
            </h3>
            <ShareLink page={page} />
          </section>
        </div>
      ) : null}
    </Modal>
  );
}
