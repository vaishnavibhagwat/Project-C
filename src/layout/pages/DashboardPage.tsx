import { Navigate, useParams } from 'react-router-dom';
import { GridContainer } from '@/grid/GridContainer';
import { WidgetCatalogue } from '@/grid/WidgetCatalogue';
import { routePath } from '@/hooks/useAppRoute';
import { useDashboardStore } from '@/store/dashboardStore';
import { PageIdSchema } from '@/store/schemas';
import { RiskSettingsContext } from '@/hooks/useRiskSettings';
import { PortfolioSummaryStrip } from '../PortfolioSummaryStrip';
import { RiskControls } from '../RiskControls';

/**
 * One dashboard: the widget grid for the page in the URL (the Workstation also gets the
 * Portfolio Summary Strip above it). In edit mode the widget catalogue sits beside the grid.
 * Lazy-loaded, so react-grid-layout stays out of the main
 * bundle. Unknown page ids go to the workstation.
 */
export default function DashboardPage() {
  const { pageId } = useParams();
  const page = PageIdSchema.safeParse(pageId);
  const editing = !useDashboardStore((s) => s.locked);
  const riskSettings = useDashboardStore((s) => s.riskSettings);
  if (!page.success) return <Navigate to={routePath('workstation')} replace />;
  return (
    <>
      {page.data === 'workstation' ? <PortfolioSummaryStrip /> : null}
      {page.data === 'risk' ? <RiskControls /> : null}
      {/* The Risk page's confidence and horizon reach its risk widgets through this context. */}
      <RiskSettingsContext.Provider value={page.data === 'risk' ? riskSettings : null}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <GridContainer key={page.data} page={page.data} />
          </div>
          {editing ? <WidgetCatalogue page={page.data} /> : null}
        </div>
      </RiskSettingsContext.Provider>
    </>
  );
}
