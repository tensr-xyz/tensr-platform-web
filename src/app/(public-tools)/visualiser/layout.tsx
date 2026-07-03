import type { Metadata } from 'next';

const siteUrl = 'https://www.tensr.xyz/visualiser';
const siteName = 'Tensr Visualiser';
const siteDescription =
  'View and analyze CSV and Excel files instantly in your browser. Fast, secure, and powerful spreadsheet visualisation tool with support for large datasets.';

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    'csv viewer',
    'excel viewer',
    'spreadsheet viewer',
    'data visualization',
    'csv to table',
    'excel online',
    'spreadsheet online',
    'data analysis',
    'tensr',
    'file viewer',
  ],
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName,
    title: siteName,
    description: siteDescription,
    images: [
      {
        url: '/tensr_logo_light.png',
        width: 1200,
        height: 630,
        alt: 'Tensr Visualiser',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteName,
    description: siteDescription,
    images: ['/tensr_logo_light.png'],
    creator: '@TensrXYZ',
  },
};

export default function VisualiserLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="h-screen">{children}</div>;
}
