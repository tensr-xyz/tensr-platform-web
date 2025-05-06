import Billing from '@/components/templates/settings/billing';
import Loading from '@/components/molecules/loading';
import { Suspense } from 'react';

export default function BillingPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Billing />
    </Suspense>
  );
}
