import UsageDashboard from '@/components/templates/settings/usage';
import Loading from '@/components/molecules/loading';
import { Suspense } from 'react';

export default function UsagePage() {
  return (
    <Suspense fallback={<Loading />}>
      <UsageDashboard />
    </Suspense>
  );
}
