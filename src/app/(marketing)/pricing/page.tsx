import type { Metadata } from 'next';
import { PricingContent } from '@/components/templates/marketing/content/pricing';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple, scalable pricing for researchers, analysts, and teams. No student tier — a serious tool for serious work.',
  alternates: {
    canonical: 'https://www.tensr.xyz/pricing',
  },
};

export default function PricingPage() {
  return <PricingContent />;
}
