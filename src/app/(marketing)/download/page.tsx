import type { Metadata } from 'next';
import DownloadTemplate from '@/components/templates/marketing/templates/download';

export const metadata: Metadata = {
  title: 'Get Started',
  description:
    'Get started with Tensr: Access our web platform, integrate with our API, or use our SDK to build custom plugins. Available for researchers and data scientists.',
  keywords: [
    'get started tensr',
    'download tensr',
    'tensr api',
    'tensr sdk',
    'statistical analysis api',
    'research software sdk',
    'data analysis platform',
    'tensr integration',
  ],
  alternates: {
    canonical: 'https://www.tensr.xyz/download',
  },
  openGraph: {
    type: 'website',
    title: 'Get Started | Tensr',
    description:
      'Access Tensr web platform, integrate with our API, or use our SDK to build custom plugins. Start your statistical analysis journey today.',
    url: 'https://www.tensr.xyz/download',
    images: [
      {
        url: '/tensr_logo_light.png',
        width: 1200,
        height: 630,
        alt: 'Get Started with Tensr',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Get Started | Tensr',
    description:
      'Access Tensr web platform, integrate with our API, or use our SDK to build custom plugins.',
    images: ['/tensr_logo_light.png'],
  },
};

export default function DownloadPage() {
  return <DownloadTemplate />;
}
