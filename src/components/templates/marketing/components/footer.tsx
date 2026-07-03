'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Monitor, Sun, Moon } from 'lucide-react';

export const Footer = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const getIndicatorPosition = () => {
    if (theme === 'system') return '2px';
    if (theme === 'light') return 'calc(2px + 36px)';
    if (theme === 'dark') return 'calc(2px + 36px + 36px)';
    return '2px';
  };

  return (
    <footer className="pt-12 pb-12 md:pb-12 bg-card relative">
      <div className="mb-9 max-w-7xl mx-auto px-4 md:px-0">
        <nav>
          <div className="gap-x-4 gap-y-8 grid grid-cols-2 md:grid-cols-5">
            <div>
              <h3 className="text-base md:text-sm text-muted-foreground pb-2.5">Product</h3>
              <ul>
                <li>
                  <Link
                    href="/features"
                    className="text-base md:text-sm py-2.5 inline-block hover:text-font transition-colors"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="text-base md:text-sm py-2.5 inline-block hover:text-font transition-colors"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="https://tensr-1.gitbook.io/tensr/"
                    className="text-base md:text-sm py-2.5 inline-block hover:text-font transition-colors"
                  >
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link
                    href="/download"
                    className="text-base md:text-sm py-2.5 inline-block hover:text-font transition-colors"
                  >
                    Download
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-base md:text-sm text-muted-foreground pb-2.5">Resources</h3>
              <ul>
                <li>
                  <Link
                    href="https://tensr-1.gitbook.io/tensr/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base md:text-sm py-2.5 inline-block hover:text-font transition-colors"
                  >
                    Documentation
                    <span className="ml-1">&nbsp;↗</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="text-base md:text-sm py-2.5 inline-block hover:text-font transition-colors"
                  >
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-base md:text-sm text-muted-foreground pb-2.5">Company</h3>
              <ul>
                <li>
                  <Link
                    href="/about"
                    className="text-base md:text-sm py-2.5 inline-block hover:text-font transition-colors"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    href="/careers"
                    className="text-base md:text-sm py-2.5 inline-block hover:text-font transition-colors"
                  >
                    Careers
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-base md:text-sm text-muted-foreground pb-2.5">Legal</h3>
              <ul>
                <li>
                  <Link
                    href="/terms-of-service"
                    className="text-base md:text-sm py-2.5 inline-block hover:text-font transition-colors"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-base md:text-sm py-2.5 inline-block hover:text-font transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-base md:text-sm text-muted-foreground pb-2.5">Connect</h3>
              <ul>
                <li>
                  <Link
                    href="https://twitter.com/tensrxyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base md:text-sm py-2.5 inline-block hover:text-font transition-colors"
                  >
                    X<span className="ml-1">&nbsp;↗</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </div>
      <div className="gap-8 max-w-7xl mx-auto flex flex-col items-start justify-between md:flex-row md:items-center">
        <div className="text-muted-foreground gap-6 flex items-center">
          <small className="text-base md:text-sm">
            © {new Date().getFullYear()}{' '}
            <Link href="/" className="hover:text-font active:text-font">
              Tensr, Inc.
            </Link>
          </small>
        </div>
        <div className="gap-6 flex items-center">
          <div className="md:text-sm rounded-full bg-[var(--color-theme-card-03-hex,#e6e5e0)] relative flex text-center p-0.5">
            <div
              className="absolute rounded-full transition-all bg-[var(--color-theme-fg-10,#26251e1a)] border border-[var(--color-theme-border-01,rgba(38,37,30,0.024))]"
              style={{
                left: getIndicatorPosition(),
                width: '36px',
                top: '2px',
                bottom: '2px',
                transitionDuration: 'var(--duration, 200ms)',
                transitionTimingFunction: 'var(--ease-out-spring, cubic-bezier(0.4, 0, 0.2, 1))',
              }}
            />
            <button
              className="relative flex cursor-pointer items-center justify-center rounded-full leading-none w-9 h-7 text-sm text-[var(--color-theme-text,#26251e)]"
              aria-label="System theme"
              onClick={() => setTheme('system')}
            >
              <Monitor className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              className="relative flex cursor-pointer items-center justify-center rounded-full leading-none w-9 h-7 text-sm text-[var(--color-theme-text-sec,rgba(38,37,30,0.6))] hover:text-[var(--color-theme-text,#26251e)]"
              aria-label="Light theme"
              onClick={() => setTheme('light')}
            >
              <Sun className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              className="relative flex cursor-pointer items-center justify-center rounded-full leading-none w-9 h-7 text-sm text-[var(--color-theme-text-sec,rgba(38,37,30,0.6))] hover:text-[var(--color-theme-text,#26251e)]"
              aria-label="Dark theme"
              onClick={() => setTheme('dark')}
            >
              <Moon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
