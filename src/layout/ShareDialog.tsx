import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { IconCopy } from '@/components/Icons';
import { Modal } from '@/components/Overlay';
import type { PageMeta } from '@/registry/pages';
import { captureSnapshot } from '@/store/actions';
import { useLayoutStore } from '@/store/layoutStore';
import { buildShareUrl, encodeShare, snapshotBytes } from '@/store/share';
import { useThemeStore } from '@/store/themeStore';

/** Share the current page layout as a compressed, validated link (lz-string). */
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
      description="The link contains layout and widget settings only. Recipients see their own simulated data."
    >
      {open ? <ShareBody page={page} /> : null}
    </Modal>
  );
}

function ShareBody({ page }: { page: PageMeta }) {
  const themeId = useThemeStore((s) => s.activeThemeId);
  const setLastShareUrl = useLayoutStore((s) => s.setLastShareUrl);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const result = useMemo(() => {
    const snapshot = captureSnapshot(page.id);
    try {
      const encoded = encodeShare(snapshot, themeId);
      return {
        ok: true as const,
        url: buildShareUrl(encoded, page.id),
        bytes: snapshotBytes(snapshot),
        encodedLength: encoded.length,
      };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : 'Could not create link.',
      };
    }
  }, [page.id, themeId]);

  if (!result.ok) return <p className="text-sm text-neg">{result.error}</p>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.url);
      setLastShareUrl(result.url);
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="share-url">
        Share link
        <textarea
          id="share-url"
          readOnly
          value={result.url}
          rows={4}
          onFocus={(e) => e.currentTarget.select()}
          className="num w-full resize-none rounded border border-line-strong bg-bg p-2 text-2xs text-fg focus:border-accent focus:outline-none"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button variant="primary" icon={IconCopy} onClick={() => void copy()}>
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
        Layout JSON {(result.bytes / 1024).toFixed(1)} KB, compressed to{' '}
        {result.encodedLength.toLocaleString('en-IN')} characters.
      </p>
    </div>
  );
}
