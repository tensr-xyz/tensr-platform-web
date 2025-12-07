import { Suspense } from 'react';
import LoginTemplate from '@/components/templates/auth/login';

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginTemplate />
    </Suspense>
  );
}
