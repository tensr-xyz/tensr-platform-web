import Loading from '@/components/molecules/loading';
import { Suspense } from 'react';
import GeneralTemplate from '@/components/templates/settings/general';

export default function GeneralPage() {
  return (
    <Suspense fallback={<Loading />}>
      <GeneralTemplate />
    </Suspense>
  );
}
