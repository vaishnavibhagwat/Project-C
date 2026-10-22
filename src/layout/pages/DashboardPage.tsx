import { Navigate, useParams } from 'react-router-dom';
import { DashboardGrid } from '@/grid/DashboardGrid';
import { routePath } from '@/hooks/useAppRoute';
import { PageIdSchema } from '@/store/schemas';
import { PortfolioSummaryStrip } from '../PortfolioSummaryStrip';

/**
 * One dashboard: the widget grid for the page in the URL (the Workstation also gets the
 * Portfolio Summary Strip above it). Lazy-loaded, so react-grid-layout stays out of the main
 * bundle. Unknown page ids go to the workstation.
 */
export default function DashboardPage() {
  const { pageId } = useParams();
  const page = PageIdSchema.safeParse(pageId);
  if (!page.success) return <Navigate to={routePath('workstation')} replace />;
  return (
    <>
      {page.data === 'workstation' ? <PortfolioSummaryStrip /> : null}
      <DashboardGrid key={page.data} page={page.data} />
    </>
  );
}
