import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import Providers from '@/utils/providers';
import { AppProvider } from '@/contexts/app-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { ProjectProvider } from '@/contexts/project-context';
import { OrganizationProvider } from '@/contexts/organisation-context';

import { ChartProvider } from '@/contexts/chart-context';
import { Toaster } from '@/components/molecules/toast/toaster';

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Tensr',
  applicationCategory: 'StatisticalAnalysisApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    category: 'Statistical Analysis Software',
  },
  description:
    'Modern statistical analysis platform for researchers and data scientists. Cloud-native architecture with powerful tools for research and collaboration.',
  url: 'https://www.tensr.xyz',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.tensr.xyz'),
  title: {
    template: '%s | Tensr',
    default: 'Tensr | Statistical Analysis Platform',
  },
  description:
    'Modern statistical analysis platform built for researchers and data scientists. Fast, intuitive, and collaborative with cloud-native architecture.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/tensr_icon_light.png',
    apple: '/tensr_icon_light.png',
  },
  keywords: [
    'tensr',
    'statistical analysis',
    'data analysis',
    'research software',
    'SPSS alternative',
    'statistics platform',
    'research statistics',
    'data science',
    'cloud statistics',
    'academic research',
    'statistical computing',
  ],
  alternates: {
    canonical: 'https://www.tensr.xyz',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    url: 'https://www.tensr.xyz',
    title: 'Tensr | Statistical Analysis Platform',
    description:
      'Modern statistical analysis platform with cloud-native architecture, powerful research tools, and collaborative features for data scientists and researchers.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Tensr - Statistical Analysis Platform',
      },
    ],
    siteName: 'Tensr',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@TensrXYZ',
    creator: '@TensrXYZ',
    title: 'Tensr | Statistical Analysis Platform',
    description:
      'Modern statistical analysis platform with cloud-native architecture and powerful research tools for data scientists.',
    images: ['/twitter-image.png'],
  },
  category: 'Statistical Analysis Software',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Script
          id="tensr-structured-data"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
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
