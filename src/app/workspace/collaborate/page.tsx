'use client';

import { Suspense } from 'react';
import Loading from '@/components/molecules/loading';
import { CollaborateJoin } from '@/components/templates/collaborate-join';
import { SubscriptionGate } from '@/components/templates/subscription-gate';

export default function CollaboratePage() {
  return (
    <SubscriptionGate>
      <Suspense fallback={<Loading fullScreen />}>
        <CollaborateJoin />
      </Suspense>
    </SubscriptionGate>
  );
}
