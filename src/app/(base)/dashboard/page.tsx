'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import HomeTemplate from '@/components/templates/home';
import { SubscriptionGate } from '@/components/templates/subscription-gate';

function DashboardContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [classic, setClassic] = useState(false);
  useEffect(() => {
    const requested = params.get('classic') === '1';
    const stored = window.localStorage.getItem('tensr-classic') === '1';
    if (requested) window.localStorage.setItem('tensr-classic', '1');
    if (requested || stored) {
      setClassic(true);
      return;
    }
    router.replace('/flow');
  }, [params, router]);
  if (!classic) return null;
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
