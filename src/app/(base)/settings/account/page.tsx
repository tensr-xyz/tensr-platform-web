import Account from '@/components/templates/settings/account';
import Loading from '@/components/molecules/loading';
import { Suspense } from 'react';

export default function AccountPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Account />
    </Suspense>
  );
}
