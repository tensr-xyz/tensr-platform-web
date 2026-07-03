'use client';

import { Suspense } from 'react';
import NewProject from '@/components/templates/project/new-project';
import { SubscriptionGate } from '@/components/templates/subscription-gate';

function NewProjectContent() {
  return (
    <SubscriptionGate>
      <NewProject />
    </SubscriptionGate>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={null}>
      <NewProjectContent />
    </Suspense>
  );
}
