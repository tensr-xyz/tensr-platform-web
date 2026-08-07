import { Suspense } from 'react';
import SubscriptionCheckoutPage from '@/components/templates/auth/subscription';
import Loading from '@/components/molecules/loading';

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<Loading fullScreen />}>
      <SubscriptionCheckoutPage />
    </Suspense>
  );
}
