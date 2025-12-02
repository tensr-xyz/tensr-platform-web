'use client';

import { SharedLayout } from '@/components/templates/shared-layout';

export default function BaseLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <SharedLayout>{children}</SharedLayout>;
}
