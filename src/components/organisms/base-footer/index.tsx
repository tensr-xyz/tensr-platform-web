'use client';

import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { FOOTER_SECTIONS } from '@/configs/footer-config';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState } from 'react';
import { LuArrowRight, LuGithub, LuTwitter } from 'react-icons/lu';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

interface FooterColumnProps {
  title: string;
  links: FooterLink[];
}

const FooterColumn: React.FC<FooterColumnProps> = ({ title, links }) => (
  <div className="flex flex-col gap-6">
    <h3 className="text-sm font-medium">{title}</h3>
    <div className="flex flex-col gap-4">
      {links.map((link, index) => (
        <Link
          key={index}
          href={link.href}
          target={link.external ? '_blank' : '_self'}
          className="text-gray-500 hover:text-gray-900 transition-colors text-sm"
        >
          {link.label}
        </Link>
      ))}
    </div>
  </div>
);

const Footer: React.FC = () => {
  const pathname = usePathname();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const hasFeatures = pathname?.includes('features');
  const backgroundClass = hasFeatures ? 'bg-[#c4d4f6]' : 'bg-white';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const response = await fetch('/api/klaviyo/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to subscribe');
      }

      setStatus('success');
      setEmail('');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to subscribe');
    }
  };

  return (
    <footer className={backgroundClass}>
      <div className="mx-auto max-w-7xl px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12">
          {/* Newsletter Section */}
          <div className="md:col-span-2 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Stay up to date</h3>
              <p className="text-gray-500 text-sm">Join our newsletter for the latest updates.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-3">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    className="max-w-72"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={status === 'loading'}
                  />
                  <Button
                    type="submit"
                    variant="default"
                    className="px-4 rounded-full group"
                    disabled={status === 'loading'}
                  >
                    {status === 'loading' ? 'Joining...' : 'Join'}
                    <LuArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
                {status === 'success' && (
                  <Alert className="bg-green-50 text-green-800 border-green-200">
                    <AlertDescription>
                      Thanks for subscribing! Please check your email to confirm.
                    </AlertDescription>
                  </Alert>
                )}
                {status === 'error' && (
                  <Alert className="bg-red-50 text-red-800 border-red-200">
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}
              </form>
            </div>

            <div className="space-y-8 mt-8">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Link href="#" className="text-gray-500 hover:text-gray-900">
                    <LuTwitter className="h-5 w-5" />
                  </Link>
                  <Link
                    href="https://github.com/tensr-xyz"
                    className="text-gray-500 hover:text-gray-900"
                  >
                    <LuGithub className="h-5 w-5" />
                  </Link>
                </div>
                <div className="text-sm text-gray-500">
                  © {new Date().getFullYear()} Tensr Inc.
                </div>
              </div>
            </div>
          </div>

          {/* Product Column */}
          <div className="md:col-span-1">
            <FooterColumn {...FOOTER_SECTIONS.product} />
          </div>

          {/* Company Column */}
          {/*<div className="md:col-span-1">*/}
          {/*  <FooterColumn {...FOOTER_SECTIONS.company} />*/}
          {/*</div>*/}

          {/* Resources Column */}
          <div className="md:col-span-1">
            <FooterColumn {...FOOTER_SECTIONS.resources} />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
