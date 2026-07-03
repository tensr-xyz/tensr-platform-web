import Link from 'next/link';
import { LogoMark } from './logo-mark';

const APP_URL = 'https://app.tensr.xyz';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-brand footer-col">
            <Link className="brand" href="/" aria-label="Tensr home">
              <span className="mark">
                <LogoMark />
              </span>
              <span className="sr-only">Tensr</span>
            </Link>
            <p className="lead">Statistical analysis that keeps up with how you actually work.</p>
          </div>
          <div className="footer-col">
            <h5>Product</h5>
            <Link href="/features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/visualiser">Visualiser</Link>
            <a href={APP_URL}>Sign in</a>
          </div>
        </div>
        <div className="footer-base">
          <span className="small">
            © {year} Tensr Labs · Statistical analysis that keeps up with how you actually work.
          </span>
          <span className="small mono">v0.42 · stats‑pack v0.4</span>
        </div>
      </div>
    </footer>
  );
}
