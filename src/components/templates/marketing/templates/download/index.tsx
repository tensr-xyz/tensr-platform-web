'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Accordion } from '@/components/templates/marketing/components/accordion';
import { Download, ArrowRight } from 'lucide-react';

export const DownloadTemplate = () => {
  const downloadItems = [
    {
      id: 'latest',
      question: 'Get Started',
      badge: 'Latest',
      answer: (
        <div className="pb-4 text-font">
          <div className="gap-4 grid grid-cols-1 md:grid-cols-3 text-font mt-4">
            {/* Web App */}
            <div className="bg-card border border-border rounded-sm flex flex-col p-6">
              <div className="mb-4 gap-3 flex items-center">
                <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
                  <span className="text-white text-sm">🌐</span>
                </div>
                <h3 className="text-base font-medium">Web App</h3>
              </div>
              <div className="divide-border flex-1 divide-y">
                <Link
                  href="https://app.tensr.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pt-4 pb-4 block w-full hover:opacity-75"
                >
                  <div className="flex items-center justify-between">
                    <span>Access Web Platform</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              </div>
            </div>

            {/* API Access */}
            <div className="bg-card border border-border rounded-sm flex flex-col p-6">
              <div className="mb-4 gap-3 flex items-center">
                <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
                  <span className="text-white text-sm">🔌</span>
                </div>
                <h3 className="text-base font-medium">API Access</h3>
              </div>
              <div className="divide-border flex-1 divide-y">
                <Link
                  href="https://tensr-1.gitbook.io/tensr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pt-4 pb-4 block w-full hover:opacity-75"
                >
                  <div className="flex items-center justify-between">
                    <span>View API Documentation</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
                <Link
                  href="https://app.tensr.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pt-4 pb-4 block w-full hover:opacity-75"
                >
                  <div className="flex items-center justify-between">
                    <span>Get API Key</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              </div>
            </div>

            {/* SDK */}
            <div className="bg-card border border-border rounded-sm flex flex-col p-6">
              <div className="mb-4 gap-3 flex items-center">
                <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
                  <span className="text-white text-sm">📦</span>
                </div>
                <h3 className="text-base font-medium">SDK & Plugins</h3>
              </div>
              <div className="divide-border flex-1 divide-y">
                <Link
                  href="https://tensr-1.gitbook.io/tensr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pt-4 pb-4 block w-full hover:opacity-75"
                >
                  <div className="flex items-center justify-between">
                    <span>View SDK Documentation</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
                <Link
                  href="https://tensr-1.gitbook.io/tensr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pt-4 pb-4 block w-full hover:opacity-75"
                >
                  <div className="flex items-center justify-between">
                    <span>Plugin Development Guide</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              </div>
            </div>
          </div>
          <div className="pt-4 pb-4">
            <Link
              href="/features"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              View all features →
            </Link>
          </div>
        </div>
      ),
    },
  ];

  return (
    <main id="main">
      {/* Hero Section */}
      <section className="py-12 bg-background text-font">
        <div className="container mx-auto">
          <div className="flex flex-wrap items-start gap-x-10 gap-y-4 sm:flex-nowrap">
            {/* App Icon */}
            <div className="flex-shrink-0">
              <div className="relative w-36 h-36">
                <picture className="block dark:hidden">
                  <Image
                    src="/tensr_icon_light.png"
                    alt="Tensr Icon"
                    fill
                    className="object-contain"
                    sizes="144px"
                  />
                </picture>
                <picture className="hidden dark:block">
                  <Image
                    src="/tensr_icon_dark.png"
                    alt="Tensr Icon"
                    fill
                    className="object-contain"
                    sizes="144px"
                  />
                </picture>
              </div>
            </div>

            <div className="max-w-2xl mt-6">
              <header className="mb-4">
                <h1 className="text-2xl md:text-3xl font-normal mb-2">Get Started with Tensr</h1>
                <p className="text-muted-foreground text-base">
                  Access Tensr from any device through our web platform, or integrate with our API
                  and SDK.
                </p>
              </header>
              <div className="mb-6">
                <div className="space-y-3">
                  <div className="hidden md:block">
                    <Link
                      href="https://app.tensr.xyz"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-6 py-3 bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] rounded-full hover:opacity-90 transition-colors text-sm font-medium"
                    >
                      Access Web Platform
                      <Download className="ml-2 h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="block md:hidden">
                    <Link
                      href="https://app.tensr.xyz"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-6 py-3 bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] rounded-full hover:opacity-90 transition-colors text-sm font-medium"
                    >
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Downloads Section */}
      <section className="py-12 bg-background text-font" id="downloads">
        <div className="container mx-auto">
          <div className="text-font w-full" data-orientation="vertical">
            <Accordion items={downloadItems} />
          </div>
        </div>
      </section>
    </main>
  );
};

export default DownloadTemplate;
