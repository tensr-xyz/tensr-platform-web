import AnalyticsDashboard from '@/components/templates/analytics-dashboard';

interface AnalyticsLayoutProps {
  columns?: { id: string; name?: string; type?: string }[];
  filePath?: string;
}

/** Charts view: full-width chart canvas only (configuration lives in left/right panels). */
const AnalyticsLayout = ({ columns, filePath }: AnalyticsLayoutProps) => {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <AnalyticsDashboard columns={columns ?? []} filePath={filePath || ''} />
    </div>
  );
};

export default AnalyticsLayout;
