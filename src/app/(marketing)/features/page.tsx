import type { Metadata } from 'next';
import { FeaturesContent } from '@/components/templates/marketing/content/features';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'The Tensr Agent, report-grade analysis output, a tri-modal workspace, real-time collaboration, and an extensible plugin marketplace.',
  alternates: {
    canonical: 'https://www.tensr.xyz/features',
  },
};

export default function FeaturesPage() {
  return <FeaturesContent />;
}
