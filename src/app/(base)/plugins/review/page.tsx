import PluginReviewQueue from '@/components/templates/plugin-review-queue';
import { Suspense } from 'react';
import { Loader } from '@/components/molecules/loading';

export default function PluginsReviewPage() {
  return (
    <Suspense fallback={<Loader centered message="Loading…" />}>
      <PluginReviewQueue />
    </Suspense>
  );
}
