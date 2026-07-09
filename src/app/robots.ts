import { MetadataRoute } from 'next';

/** App subdomain should not compete with www.tensr.xyz for indexing. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  };
}
