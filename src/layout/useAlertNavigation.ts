import { useToast } from '@/components/Toast';
import { locateWidget, requestReveal } from '@/grid/revealWidget';
import { isPageRoute, PAGE_ROUTES, useAppRoute } from '@/hooks/useAppRoute';
import { useEventBus } from '@/hooks/useEventBus';
import { getPageMeta } from '@/registry/pages';
import { widgetRegistry } from '@/registry/registry';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';

/**
 * ALERT_CLICKED, app side: if the widget an alert is about is on another page, switch to that
 * page and ask its grid to reveal it (GridContainer reveals widgets on the current page
 * itself). If no page has the widget, say so. Mounted once, in AppShell.
 */
export function useAlertNavigation(): void {
  const { route, navigate } = useAppRoute();
  const notify = useToast();
  useEventBus('ALERT_CLICKED', ({ relatedWidget }) => {
    const { instances } = useWidgetStore.getState();
    const found = locateWidget(relatedWidget, isPageRoute(route) ? route : null, PAGE_ROUTES, {
      pages: useDashboardStore.getState().pages,
      widgetIdOf: (id) => instances[id]?.widgetId,
    });
    const name = widgetRegistry.getWidget(relatedWidget)?.name ?? relatedWidget;
    if (!found) {
      notify({ message: `${name} is not on any page. Add it from the Widget Marketplace.` });
      return;
    }
    if (found.page === route) return;
    requestReveal(found.instanceId);
    navigate(found.page);
    notify({ message: `Opened ${getPageMeta(found.page).title} to show ${name}.` });
  });
}
