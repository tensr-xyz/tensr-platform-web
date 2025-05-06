import Loading from '@/components/molecules/loading';
import { Suspense } from 'react';
import Organisation from '@/components/templates/settings/organisation';

export default function OrganisationPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Organisation />
    </Suspense>
  );
}
