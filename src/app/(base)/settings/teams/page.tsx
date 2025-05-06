import Loading from '@/components/molecules/loading';
import { Suspense } from 'react';
import Teams from '@/components/templates/settings/teams';

export default function OrganisationPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Teams />
    </Suspense>
  );
}
