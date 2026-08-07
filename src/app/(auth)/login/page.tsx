import { Suspense } from 'react';
import LoginTemplate from '@/components/templates/auth/login';
import Loading from '@/components/molecules/loading';

export default function LoginPage() {
  return (
    <Suspense fallback={<Loading fullScreen />}>
      <LoginTemplate />
    </Suspense>
  );
}
