import { Suspense } from 'react';
import Loading from '@/components/molecules/loading';
import Plugin from '@/components/templates/plugin';

export default function PluginPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Plugin />
    </Suspense>
  );
}
