import CreatorDashboard from '@/components/templates/creator-dashboard';
import { Suspense } from 'react';
import Loading from '@/components/molecules/loading';

export default function CreatorPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CreatorDashboard />
    </Suspense>
  );
}
