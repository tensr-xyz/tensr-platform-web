import PluginsLayout from '@/components/templates/plugins-layout';
import { SubscriptionGate } from '@/components/templates/subscription-gate';
import { Suspense } from 'react';
import Loading from '@/components/molecules/loading';

export default function PluginsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SubscriptionGate>
        <PluginsLayout />
      </SubscriptionGate>
    </Suspense>
  );
}
