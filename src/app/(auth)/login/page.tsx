import { Suspense } from 'react';
import LoginTemplate from '@/components/templates/auth/login';
import Loading from '@/components/molecules/loading';
import { isAuthReturn, SIGNING_IN_MESSAGE } from '@/lib/signing-in';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const params = new URLSearchParams(
    Object.entries(raw).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value]]
    )
  );
  // An OAuth return has already signed in: say so from the first paint, not after the form flashes.
  const message = isAuthReturn(params) ? SIGNING_IN_MESSAGE : undefined;
  return (
    <Suspense fallback={<Loading fullScreen message={message} />}>
      <LoginTemplate />
    </Suspense>
  );
}
