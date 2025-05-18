import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { TabsProvider } from '@/contexts/tabs-context';
import { ProjectProvider } from '@/contexts/project-context';
import { SidebarProvider } from '@/components/organisms/sidebar';
import { AuthProvider } from '@/contexts/auth-context';
import { AppProvider } from '@/contexts/app-context';
import { ChartProvider } from '@/contexts/chart-context';
import { ThemeProvider } from '@/contexts/theme-context';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

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

  // Add structured data as a script
  other: {
    'script:ld+json': JSON.stringify(structuredData),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <AppProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ProjectProvider>
              <AuthProvider>
                <TabsProvider>
                  <ChartProvider>
                    <SidebarProvider>{children}</SidebarProvider>
                  </ChartProvider>
                </TabsProvider>
              </AuthProvider>
            </ProjectProvider>
          </ThemeProvider>
        </AppProvider>
      </body>
    </html>
  );
}
