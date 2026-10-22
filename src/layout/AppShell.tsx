import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Overlay';
import { useToast } from '@/components/Toast';
import { getConnectionState, setSimulatedOutage } from '@/data/connection';
import { ConfigPanel } from '@/grid/ConfigPanel';
import { isPageRoute, useAppRoute } from '@/hooks/useAppRoute';
import { SymbolDetailContext, type SymbolDetailApi } from '@/hooks/useSymbolDetail';
import { getPageMeta } from '@/registry/pages';
import { addWidgetToPage, MAX_WIDGETS_PER_PAGE, resetPage } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useThemeStore } from '@/store/themeStore';
import type { AppRoute, PageId } from '@/types';
import { CommandBar } from './CommandBar';
import { CommandPalette } from './CommandPalette';
import { LayoutManager } from './LayoutManager';
import { NAV_ITEMS, NavRail } from './NavRail';
import { PageToolbar } from './PageToolbar';
import type { SearchResult } from './searchIndex';
import { ShareDialog } from './ShareDialog';
import { SharedLayoutBanner } from './SharedLayoutBanner';
import type { ShellContext } from './shellContext';
import { SymbolDetail } from './SymbolDetail';

// The theme builder pulls in react-colorful; load it only when someone opens it.
const ThemeBuilder = lazy(() => import('@/theme/ThemeBuilder'));

const ROUTE_TITLES: Partial<Record<AppRoute, string>> = {
  marketplace: 'Widget Marketplace',
  settings: 'Settings',
};

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** Dense placeholder while a page's code chunk loads. */
function PageFallback() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2">
      <div className="skeleton h-8 w-72" />
      <div className="grid grid-cols-12 gap-2">
        <div className="skeleton col-span-12 h-32" />
        <div className="skeleton col-span-6 h-80" />
        <div className="skeleton col-span-6 h-80" />
      </div>
    </div>
  );
}

/**
 * Application frame and router layout: nav rail, command bar, the routed page (lazy, via
 * <Outlet>) and global overlays. Dashboards get the page toolbar and shared-layout banner.
 */
export function AppShell() {
  const { route, params, navigate, clearParams } = useAppRoute();
  const [lastPage, setLastPage] = useState<PageId>('workstation');
  const [searchOpen, setSearchOpen] = useState(false);
  const [layoutsOpen, setLayoutsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [symbol, setSymbol] = useState<string | null>(null);
  const builderOpen = useThemeStore((s) => s.builder.open);
  const openBuilder = useThemeStore((s) => s.openBuilder);
  const notify = useToast();
  const gPressed = useRef(0);

  const onDashboard = isPageRoute(route);
  const page: PageId = isPageRoute(route) ? route : lastPage;
  const meta = getPageMeta(page);
  const shared = params.get('share');

  useEffect(() => {
    if (isPageRoute(route)) setLastPage(route);
  }, [route]);

  useEffect(() => {
    const title = (route && ROUTE_TITLES[route]) ?? meta.title;
    document.title = `${title} · Meridian Capital`;
  }, [route, meta.title]);

  const go = useCallback((r: AppRoute) => navigate(r), [navigate]);

  const toggleLock = useCallback(() => {
    const { locked, setLocked } = useDashboardStore.getState();
    setLocked(!locked);
    notify({ message: locked ? 'Layout unlocked' : 'Layout locked' });
  }, [notify]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key.toLowerCase() === 'g') {
        gPressed.current = Date.now();
      } else if (/^[1-9]$/.test(e.key) && Date.now() - gPressed.current < 1200) {
        const item = NAV_ITEMS[Number(e.key) - 1];
        if (item) go(item.route);
        gPressed.current = 0;
      } else if (e.key.toLowerCase() === 'l') {
        toggleLock();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, toggleLock]);

  const onSelect = useCallback(
    (r: SearchResult) => {
      setSearchOpen(false);
      switch (r.kind) {
        case 'page':
          go(r.route);
          break;
        case 'symbol':
          setSymbol(r.symbol);
          break;
        case 'widget':
          if (addWidgetToPage(page, r.type)) {
            if (!onDashboard) go(page);
            notify({ message: `Added ${r.label} to ${meta.short}`, tone: 'success' });
          } else {
            notify({
              message: `This page already has the maximum of ${MAX_WIDGETS_PER_PAGE} widgets. Remove one first.`,
              tone: 'error',
            });
          }
          break;
        case 'action':
          if (r.action === 'toggle-lock') toggleLock();
          if (r.action === 'open-layouts') setLayoutsOpen(true);
          if (r.action === 'share-layout') setShareOpen(true);
          if (r.action === 'open-theme-builder') openBuilder();
          if (r.action === 'toggle-outage')
            setSimulatedOutage(!getConnectionState().simulatedOutage);
          break;
      }
    },
    [go, meta.short, notify, onDashboard, openBuilder, page, toggleLock],
  );

  const symbolApi = useMemo<SymbolDetailApi>(() => ({ openSymbol: setSymbol }), []);
  const outletContext = useMemo<ShellContext>(
    () => ({ lastPage, openLayouts: () => setLayoutsOpen(true) }),
    [lastPage],
  );

  return (
    <SymbolDetailContext.Provider value={symbolApi}>
      <a
        href="#main"
        onClick={(e) => {
          // A plain #main link would change the router's hash; move focus instead.
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[80] focus:rounded focus:bg-accent focus:px-3 focus:py-1 focus:text-accent-fg"
      >
        Skip to content
      </a>
      <div className="flex h-full">
        <NavRail />
        <div className="flex min-w-0 flex-1 flex-col">
          <CommandBar
            page={page}
            onOpenSearch={() => setSearchOpen(true)}
            onOpenLayouts={() => setLayoutsOpen(true)}
          />
          <main
            id="main"
            tabIndex={-1}
            className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3 outline-none"
          >
            {shared && onDashboard ? (
              <SharedLayoutBanner encoded={shared} page={page} onDone={clearParams} />
            ) : null}
            {onDashboard ? (
              <PageToolbar
                page={meta}
                onOpenMarketplace={() => navigate('marketplace', { target: page })}
                onOpenLayouts={() => setLayoutsOpen(true)}
                onShare={() => setShareOpen(true)}
                onReset={() => setResetOpen(true)}
              />
            ) : null}
            <Suspense fallback={<PageFallback />}>
              <Outlet context={outletContext} />
            </Suspense>
          </main>
        </div>
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={onSelect} />
      <ConfigPanel />
      <LayoutManager open={layoutsOpen} onClose={() => setLayoutsOpen(false)} page={meta} />
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} page={meta} />
      <SymbolDetail symbol={symbol} onClose={() => setSymbol(null)} />
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={`Reset ${meta.short}?`}
        description="Restores this page's default widgets, settings and layout."
        footer={
          <>
            <Button onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                resetPage(page);
                setResetOpen(false);
                notify({ message: `${meta.short} reset to default`, tone: 'success' });
              }}
            >
              Reset page
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Save the current layout first from Layouts if you want to keep it.
        </p>
      </Modal>
      {builderOpen ? (
        <Suspense fallback={null}>
          <ThemeBuilder />
        </Suspense>
      ) : null}
    </SymbolDetailContext.Provider>
  );
}
