import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/utils/providers';
import { AppProvider } from '@/contexts/app-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { ProjectProvider } from '@/contexts/project-context';
import { OrganizationProvider } from '@/contexts/organisation-context';

import { ChartProvider } from '@/contexts/chart-context';
import { Toaster } from '@/components/molecules/toast/toaster';

export const metadata: Metadata = {
  metadataBase: new URL('https://app.tensr.xyz'),
  title: {
    template: '%s | Tensr',
    default: 'Tensr',
  },
  description:
    'Tensr statistical analysis workspace — upload datasets, run analyses, and collaborate.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/tensr_icon_light.png', sizes: '560x576', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: 'website',
    url: 'https://app.tensr.xyz',
    title: 'Tensr',
    description:
      'Tensr statistical analysis workspace — upload datasets, run analyses, and collaborate.',
    siteName: 'Tensr',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    site: '@TensrXYZ',
    creator: '@TensrXYZ',
    title: 'Tensr',
    description:
      'Tensr statistical analysis workspace — upload datasets, run analyses, and collaborate.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <AppProvider>
            <ThemeProvider>
              <ProjectProvider>
                <OrganizationProvider>
                  <ChartProvider>
                    {children}
                    <Toaster />
                  </ChartProvider>
                </OrganizationProvider>
              </ProjectProvider>
            </ThemeProvider>
          </AppProvider>
        </Providers>
      </body>
    </html>
  );
}
