'use client';

import { ChevronDown, Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

const MobileMenu = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [resourcesOpen, setResourcesOpen] = useState(false);

  return (
    <nav
      className={`bg-background px-4 fixed inset-0 z-50 overscroll-contain transition-opacity duration-300 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      role="navigation"
    >
      <header className="text-lg mb-3 flex h-14 items-center justify-end">
        <button
          type="button"
          className='w-6 h-6 relative inline-flex cursor-pointer items-center justify-center after:absolute after:inset-[-0.5rem] after:content-[""] z-[51] -mr-[0.3rem]'
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X className="h-full w-full" />
        </button>
      </header>
      <ul className="flex flex-col relative z-50">
        <li>
          <Link
            href="/features"
            className="text-lg py-3 block hover:opacity-70 transition-opacity cursor-pointer"
            onClick={onClose}
          >
            Features
          </Link>
        </li>
        <li>
          <Link
            href="/pricing"
            className="text-lg py-3 block hover:opacity-70 transition-opacity cursor-pointer"
            onClick={onClose}
          >
            Pricing
          </Link>
        </li>
        <li>
          <Link
            href="/enterprise"
            className="text-lg py-3 block hover:opacity-70 transition-opacity cursor-pointer"
            onClick={onClose}
          >
            Enterprise
          </Link>
        </li>
        <li>
          <Link
            href="https://view.tensr.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg py-3 block hover:opacity-70 transition-opacity cursor-pointer"
            onClick={onClose}
          >
            Visualiser
          </Link>
        </li>
        <li className="relative">
          <button
            className="text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 py-3 flex w-full cursor-pointer items-center"
            type="button"
            aria-expanded={resourcesOpen}
            onClick={() => setResourcesOpen(!resourcesOpen)}
          >
            Resources
            <span className="ml-1" aria-hidden="true">
              →
            </span>
          </button>
          {resourcesOpen && (
            <div className="pl-4">
              <Link
                href="https://tensr-1.gitbook.io/tensr/"
                className="text-lg py-3 block hover:opacity-70 transition-opacity cursor-pointer"
                onClick={onClose}
              >
                Documentation
              </Link>
            </div>
          )}
        </li>
      </ul>
    </nav>
  );
};

export const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  return (
    <>
      <header className="bg-background px-4 fixed top-0 left-0 z-50 w-full">
        <div className="relative z-[2] max-w-7xl mx-auto grid h-14 grid-cols-[1fr_auto_auto] items-center lg:grid-cols-[auto_1fr_auto]">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-2 focus:py-1 focus:bg-[var(--color-button-primary-bg)] focus:text-[var(--color-button-primary-text)] focus:rounded text-sm"
          >
            Skip to content
          </a>
          <div className="col-start-1 col-end-2 row-start-1 row-end-2">
            <Link
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 relative top-[0.2rem] left-[-2px] inline-flex"
              aria-label="Homepage"
              href="/"
            >
              <Image
                src="/tensr_logo_light.png"
                alt="Tensr Logo"
                height={24}
                width={96}
                className="h-6 w-auto dark:hidden"
                style={{ width: 'auto', height: '24px' }}
              />
              <Image
                src="/tensr_logo_dark.png"
                alt=""
                aria-hidden
                height={24}
                width={96}
                className="hidden h-6 w-auto dark:block"
                style={{ width: 'auto', height: '24px' }}
              />
              <span className="sr-only">Tensr</span>
            </Link>
          </div>
          <div className="hidden lg:block">
            <nav
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              role="navigation"
            >
              <ul className="flex items-center justify-center">
                <li>
                  <Link
                    href="/features"
                    className="px-4 py-2 text-sm hover:opacity-70 transition-opacity"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="px-4 py-2 text-sm hover:opacity-70 transition-opacity"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/enterprise"
                    className="px-4 py-2 text-sm hover:opacity-70 transition-opacity"
                  >
                    Enterprise
                  </Link>
                </li>
                <li>
                  <Link
                    href="https://view.tensr.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm hover:opacity-70 transition-opacity"
                  >
                    Visualiser
                  </Link>
                </li>
                <li className="relative group">
                  <button
                    className="px-4 py-2 text-sm hover:opacity-70 transition-opacity flex items-center gap-1"
                    type="button"
                    aria-label="Expand Menu"
                    aria-expanded={resourcesOpen}
                    onMouseEnter={() => setResourcesOpen(true)}
                    onMouseLeave={() => setResourcesOpen(false)}
                  >
                    Resources
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${
                        resourcesOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    className={`pt-1 absolute top-full left-0 transition-all duration-200 ${resourcesOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'}`}
                    onMouseEnter={() => setResourcesOpen(true)}
                    onMouseLeave={() => setResourcesOpen(false)}
                  >
                    <div className="relative bg-[var(--color-theme-card-hex)] rounded shadow-xl p-3 text-sm before:content-[''] before:pointer-events-none before:rounded before:border before:border-[var(--color-theme-border-01)] before:absolute before:inset-0">
                      <ul>
                        <li className="min-w-[8rem]">
                          <Link
                            href="https://tensr-1.gitbook.io/tensr/"
                            className="block hover:opacity-70 transition-opacity"
                          >
                            Documentation
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </li>
              </ul>
            </nav>
          </div>
          <div className="block lg:hidden">
            <div className="col-start-4 col-end-[-1] row-start-1 row-end-2 flex items-center justify-center">
              <button
                type="button"
                className='focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 w-6 h-6 relative inline-flex cursor-pointer items-center justify-center after:absolute after:inset-[-0.5rem] after:content-[""] ml-4 -mr-[0.3rem]'
                aria-label="Open navigation"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="h-full w-full" />
              </button>
            </div>
          </div>
          <div className="gap-3 col-start-2 col-end-3 row-start-1 row-end-2 flex items-center justify-self-end lg:col-start-3 lg:col-end-[-1]">
            <Link
              href="https://app.tensr.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 h-9 flex items-center text-sm hover:opacity-70 transition-opacity"
            >
              Sign in
            </Link>
            <Link
              href="/download"
              className="hidden sm:inline-flex items-center px-4 h-9 text-sm border border-[var(--color-button-primary-border)] text-[var(--color-button-primary-bg)] rounded-full hover:opacity-90 transition-colors"
            >
              Download
            </Link>
            <Link
              href="https://app.tensr.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center px-4 h-9 text-sm bg-[var(--color-button-primary-bg)] border border-[var(--color-button-primary-border)] text-[var(--color-button-primary-text)] rounded-full hover:opacity-90 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </>
  );
};
