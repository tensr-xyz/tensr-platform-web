'use client';

import { useSyncExternalStore } from 'react';
import Loading from '@/components/molecules/loading';
import { SIGNING_IN_MESSAGE, isSigningIn } from '@/lib/signing-in';

/** The app's one loading state while a sign-in lands. */
export function SigningIn() {
  return <Loading fullScreen message={SIGNING_IN_MESSAGE} />;
}

const noSubscribe = () => () => undefined;

/** A Suspense fallback that keeps "Signing you in…" up across the route change; blank otherwise, as before. */
export function SigningInFallback() {
  const landing = useSyncExternalStore(
    noSubscribe,
    () => isSigningIn(),
    () => false
  );
  return landing ? <SigningIn /> : null;
}
