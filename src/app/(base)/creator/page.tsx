import CreatorComingSoon from '@/components/templates/creator-coming-soon';
import { Suspense } from 'react';
import Loading from '@/components/molecules/loading';

export default function CreatorPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CreatorComingSoon />
    </Suspense>
  );
}
