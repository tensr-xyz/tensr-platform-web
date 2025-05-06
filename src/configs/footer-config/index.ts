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
      { label: 'Docs', href: '/docs' },
      { label: 'Demo', href: '/demo' },
      { label: 'Features', href: '/features' },
      { label: 'Security', href: '/security' },
    ],
  },
  company: {
    title: 'Company',
    links: [
      { label: 'About us', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Blog', href: '/blog' },
      { label: 'Customer love', href: '/customers' },
      { label: 'Brand guidelines', href: '/brand' },
    ],
  },
  resources: {
    title: 'Resources',
    links: [
      { label: 'Status', href: '/status' },
      { label: 'Support', href: '/support' },
      { label: 'Privacy policy', href: '/privacy' },
      { label: 'Terms of service', href: '/terms' },
    ],
  },
};
