'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from './logo-mark';

const APP_URL = 'https://app.tensr.xyz';

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/visualiser', label: 'Visualiser' },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link className="brand" href="/" aria-label="Tensr home">
          <span className="mark">
            <LogoMark />
          </span>
          <span className="sr-only">Tensr</span>
        </Link>
        <div className="nav-links">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              className="nav-link"
              href={href}
              aria-current={pathname === href ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="nav-cta">
          <a className="btn btn-ghost btn-sm" href={APP_URL}>
            Sign in
          </a>
          <Link className="btn btn-primary btn-sm" href="/pricing">
            View plans
          </Link>
        </div>
      </div>
    </nav>
  );
}
