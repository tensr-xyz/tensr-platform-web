import type { Metadata } from 'next';
import '@/styles/marketing/tensr-marketing.css';
import { MarketingRoot } from '@/components/templates/marketing/components/marketing-root';
import { SiteNav } from '@/components/templates/marketing/components/site-nav';
import { SiteFooter } from '@/components/templates/marketing/components/site-footer';
import { SiteEffects } from '@/components/templates/marketing/components/site-effects';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.tensr.xyz'),
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <MarketingRoot>
      <SiteNav />
      <main id="main">{children}</main>
      <SiteFooter />
      <SiteEffects />
    </MarketingRoot>
  );
}
