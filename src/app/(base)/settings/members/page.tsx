import Loading from '@/components/molecules/loading';
import { Suspense } from 'react';
import Members from '@/components/templates/settings/members';

export default function OrganisationPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Members />
    </Suspense>
  );
}
