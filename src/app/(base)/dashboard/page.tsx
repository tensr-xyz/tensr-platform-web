'use client';

import { Suspense } from 'react';
import HomeTemplate from '@/components/templates/home';
import { SubscriptionGate } from '@/components/templates/subscription-gate';

function DashboardContent() {
  return (
    <SubscriptionGate>
      <HomeTemplate />
    </SubscriptionGate>
  );
}

export default function BasePage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
