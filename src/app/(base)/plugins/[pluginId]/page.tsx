'use client';

import PluginDetails from '@/components/templates/plugin-details';
import { Suspense } from 'react';
import Loading from '@/components/molecules/loading';

export default function PluginDetailsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PluginDetails />
    </Suspense>
  );
}
