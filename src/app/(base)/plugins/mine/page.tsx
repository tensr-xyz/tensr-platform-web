import MyPlugins from '@/components/templates/my-plugins';
import { Suspense } from 'react';
import { Loader } from '@/components/molecules/loading';

export default function MyPluginsPage() {
  return (
    <Suspense fallback={<Loader centered message="Loading…" />}>
      <MyPlugins />
    </Suspense>
  );
}
