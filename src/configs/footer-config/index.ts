import Link from 'next/link';
import React from 'react';

interface FooterSection {
  title: string;
  links: FooterLink[];
}

interface FooterStructure {
  product: FooterSection;
  company: FooterSection;
  resources: FooterSection;
}

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export const FOOTER_SECTIONS: FooterStructure = {
  product: {
    title: 'Product',
    links: [
      { label: 'Docs', href: 'https://tensr-1.gitbook.io/tensr/' },
      {
        label: 'Features',
        href: 'https://www.tensr.xyz/features',
      },
      {
        label: 'Pricing',
        href: 'https://www.tensr.xyz/pricing',
      },
    ],
  },
  company: {
    title: 'Company',
    links: [{ label: 'Contact', href: 'mailto:help@tensr.xyz' }],
  },
  resources: {
    title: 'Resources',
    links: [
      { label: 'Support', href: 'mailto:help@tensr.xyz' },
      {
        label: 'Privacy policy',
        href: 'https://tensr-1.gitbook.io/tensr/legal-policies/privacy-policy',
      },
      {
        label: 'Terms of service',
        href: 'https://tensr-1.gitbook.io/tensr/legal-policies/terms-of-service',
      },
    ],
  },
};
