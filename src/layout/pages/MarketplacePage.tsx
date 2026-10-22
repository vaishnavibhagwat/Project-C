import { useAppRoute } from '@/hooks/useAppRoute';
import { PageIdSchema } from '@/store/schemas';
import { useShellContext } from '../shellContext';
import { WidgetMarketplace } from '../WidgetMarketplace';

/** Widget Marketplace. `?target=<page>` preselects the dashboard widgets are added to. */
export default function MarketplacePage() {
  const { params, navigate } = useAppRoute();
  const { lastPage } = useShellContext();
  const target = PageIdSchema.safeParse(params.get('target'));
  return (
    <WidgetMarketplace
      initialTarget={target.success ? target.data : lastPage}
      onOpenPage={navigate}
    />
  );
}
