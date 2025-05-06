import PluginsLayout from '@/components/templates/plugins-layout';
import { Suspense } from 'react';
import Loading from '@/components/molecules/loading';

export default function PluginsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PluginsLayout />
    </Suspense>
  );
}
