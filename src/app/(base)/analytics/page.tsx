import PlatformAnalytics from '@/components/templates/platform-analytics';
import { Suspense } from 'react';
import Loading from '@/components/molecules/loading';

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PlatformAnalytics />
    </Suspense>
  );
}
