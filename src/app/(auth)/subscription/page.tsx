import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import SubscriptionCheckoutPage from '@/components/templates/auth/subscription';
import Loading from '@/components/molecules/loading';

// Bare /subscription was the plan-change page; that now lives in Settings › Billing.
// With a query (?returnTo= from the subscription gate, or Stripe's cancel URL) this stays the
// paywall: the gate on /flow sends unpaid users here, so redirecting those would loop.
export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  if (Object.keys(search).length === 0) redirect('/flow/settings/billing');
  return (
    <Suspense fallback={<Loading fullScreen />}>
      <SubscriptionCheckoutPage />
    </Suspense>
  );
}
