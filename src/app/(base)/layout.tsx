'use client';

import { SharedLayout } from '@/components/templates/shared-layout';
import { Suspense } from 'react';
import Loading from '@/components/molecules/loading';

export default function BaseLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={<Loading />}>
      <SharedLayout>{children}</SharedLayout>
    </Suspense>
  );
}
