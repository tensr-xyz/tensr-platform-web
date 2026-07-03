import type { Metadata } from 'next';
import EnterpriseTemplate from '@/components/templates/marketing/templates/enterprise';

export const metadata: Metadata = {
  title: 'Enterprise',
  description:
    'Tensr Enterprise: Scalable statistical analysis platform for large teams. Advanced security, SSO, SCIM, 100,000 operations/month, 100 GB data processing, and dedicated support.',
  keywords: [
    'enterprise statistical analysis',
    'enterprise research software',
    'SSO integration',
    'SCIM provisioning',
    'SOC 2 compliance',
    'GDPR compliant',
    'enterprise data analysis',
    'team collaboration',
    'dedicated support',
    'enterprise security',
  ],
  alternates: {
    canonical: 'https://www.tensr.xyz/enterprise',
  },
  openGraph: {
    type: 'website',
    title: 'Enterprise | Tensr',
    description:
      'Enterprise statistical analysis platform with advanced security, SSO, SCIM, and dedicated support. Built for large research teams and organizations.',
    url: 'https://www.tensr.xyz/enterprise',
    images: [
      {
        url: '/tensr_logo_light.png',
        width: 1200,
        height: 630,
        alt: 'Tensr Enterprise',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Enterprise | Tensr',
    description:
      'Enterprise statistical analysis platform with advanced security, SSO, SCIM, and dedicated support.',
    images: ['/tensr_logo_light.png'],
  },
};

export default function EnterprisePage() {
  return <EnterpriseTemplate />;
}
