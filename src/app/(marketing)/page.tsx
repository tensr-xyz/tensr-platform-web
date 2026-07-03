import type { Metadata } from 'next';
import { HomeContent } from '@/components/templates/marketing/content/home';

export const metadata: Metadata = {
  title: 'Tensr — The new way to analyse data',
  description:
    'Tensr is a modern, collaborative statistical workspace. Spreadsheets, statistical tests, charts, and a research-grade AI agent — in one browser-native workspace.',
  alternates: {
    canonical: 'https://www.tensr.xyz',
  },
  openGraph: {
    type: 'website',
    title: 'Tensr — The new way to analyse data',
    description:
      'Spreadsheets, statistical tests, charts, and a research-grade AI agent — in one browser-native workspace.',
    url: 'https://www.tensr.xyz',
  },
};

export default function HomePage() {
  return <HomeContent />;
}
