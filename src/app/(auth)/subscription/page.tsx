import { Suspense } from 'react';
import SubscriptionCheckoutPage from '@/components/templates/auth/subscription';

export default function SubscriptionPage() {
  return (
    <Suspense fallback={null}>
      <SubscriptionCheckoutPage />
    </Suspense>
  );
}
