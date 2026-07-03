'use client';

import { MarketingProductPreview } from '@/components/templates/marketing/marketing-product-preview';
import Link from 'next/link';
import { Accordion } from '@/components/templates/marketing/components/accordion';
import { ArrowRight } from 'lucide-react';

export const EnterpriseTemplate = () => {
  const qaItems = [
    {
      id: 'q1',
      question: 'How do usage limits work for enterprises?',
      answer:
        'Enterprise plans include 100,000 operations per month and 100 GB of data processed. Usage can be monitored through your organization dashboard, and custom limits can be configured for specific teams or users.',
    },
    {
      id: 'q2',
      question: 'How does Tensr handle large-scale datasets?',
      answer:
        'Tensr is built on cloud-native architecture designed to handle large datasets efficiently. Enterprise plans support up to 100 GB of data processed per month with scalable infrastructure that can accommodate your research needs.',
    },
    {
      id: 'q3',
      question: 'How does Tensr use my data?',
      answer:
        'Tensr follows a zero data retention policy for enterprise customers. Your data is used solely for analysis processing and is never used for training models or shared with third parties. All data is encrypted at rest and in transit.',
    },
    {
      id: 'q4',
      question: 'What security certifications does Tensr have?',
      answer:
        'Tensr is SOC 2 Type 2 certified and complies with GDPR and CCPA requirements. We undergo annual penetration testing and maintain robust data protection with AES-256 encryption at rest and TLS 1.2+ in transit.',
    },
    {
      id: 'q5',
      question: 'Does Tensr support SSO and SCIM?',
      answer:
        'Yes, Enterprise plans include SAML-based SSO integration for secure user access and SCIM user provisioning for easy user and group management across your organization.',
    },
    {
      id: 'q6',
      question: 'Does Tensr support on-premises or VPC deployment?',
      answer:
        'Enterprise customers can discuss custom deployment options including VPC deployments. Please contact our sales team to discuss your specific infrastructure requirements.',
    },
    {
      id: 'q7',
      question: 'What admin controls are available?',
      answer:
        'Enterprise plans include centralized security controls allowing you to configure access levels, manage users and groups, set usage limits, and monitor organization-wide activity through comprehensive admin dashboards.',
    },
    {
      id: 'q8',
      question: 'How can I track usage across my organization?',
      answer:
        'Enterprise plans include detailed analytics and reporting dashboards that provide insights into usage patterns, popular features, and team activity, helping you understand adoption and optimize your statistical analysis workflows.',
    },
  ];

  return (
    <main className="bg-background text-font">
      {/* Hero Section */}
      <section className="py-12 px-4 md:px-8 bg-background text-font">
        <div className="container mx-auto">
          <div className="text-left mb-4 max-w-prose">
            <small className="text-base text-muted-foreground block mb-2">Enterprise</small>
            <h1 className="text-4xl font-normal text-balance mb-4">
              Develop enduring software at scale.
            </h1>
            <div className="flex items-center justify-start gap-4 mt-6">
              <Link
                className="inline-flex items-center justify-center px-6 py-3 h-11 text-base font-medium rounded-full transition-all bg-[var(--color-button-primary-bg)] border border-[var(--color-button-primary-border)] text-[var(--color-button-primary-text)] hover:opacity-90"
                href="/contact-sales"
              >
                Contact sales
                <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Logo Garden Section */}
      <section className="py-12 px-4 md:px-8 bg-background text-font pb-6 pt-0" id="logo-garden">
        <div className="container mx-auto">
          <div className="flex flex-col text-center">
            <h2 className="text-sm text-muted-foreground mb-8">
              Trusted by research institutions and data science teams.
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {/* Samsung */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/cd42bcaf1a4ee661dac09a18f9eb36648907f38c-188x85.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Samsung logo"
                      loading="lazy"
                      decoding="async"
                      width="188"
                      height="85"
                      src="https://cdn.sanity.io/images/2hv88549/production/cd42bcaf1a4ee661dac09a18f9eb36648907f38c-188x85.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/3f30d456fd7be9e8762db0e833afd8c63b441321-188x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Samsung logo"
                      loading="lazy"
                      decoding="async"
                      width="188"
                      height="85"
                      src="https://cdn.sanity.io/images/2hv88549/production/3f30d456fd7be9e8762db0e833afd8c63b441321-188x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* OpenAI */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/a733e7c0b6d2a19f7769d1d327781dc74f577f49-159x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="OpenAI Logo"
                      loading="lazy"
                      decoding="async"
                      width="159"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/a733e7c0b6d2a19f7769d1d327781dc74f577f49-159x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/53062f7690ae5b0cdbed3ea686fcea9da8b0b0b6-159x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="OpenAI Logo"
                      loading="lazy"
                      decoding="async"
                      width="159"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/53062f7690ae5b0cdbed3ea686fcea9da8b0b0b6-159x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Zoom */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/daacbb297dd3e44afa9863911ff5d53f7fde7131-136x85.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Zoom logo"
                      loading="lazy"
                      decoding="async"
                      width="136"
                      height="85"
                      src="https://cdn.sanity.io/images/2hv88549/production/daacbb297dd3e44afa9863911ff5d53f7fde7131-136x85.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/37fb4cd3f426f086deb69ce992930dcc09fb96cd-136x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Zoom logo"
                      loading="lazy"
                      decoding="async"
                      width="136"
                      height="85"
                      src="https://cdn.sanity.io/images/2hv88549/production/37fb4cd3f426f086deb69ce992930dcc09fb96cd-136x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Datadog */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/f44dd77a6265aa8b77768cddfa25bb4a60cd13c9-201x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Datadog logo"
                      loading="lazy"
                      decoding="async"
                      width="201"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/f44dd77a6265aa8b77768cddfa25bb4a60cd13c9-201x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/da55192921531e5fd2ba00701f4bf6ffd8b1781d-196x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Datadog logo"
                      loading="lazy"
                      decoding="async"
                      width="201"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/da55192921531e5fd2ba00701f4bf6ffd8b1781d-196x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Adobe */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/bdc0f1bd4dfe8115422533f560f9f3eef7f23ac7-149x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Adobe logo"
                      loading="lazy"
                      decoding="async"
                      width="149"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/bdc0f1bd4dfe8115422533f560f9f3eef7f23ac7-149x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/37d2d1a1edcce15ca38c6021e882b6a7fff77ebb-149x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Adobe logo"
                      loading="lazy"
                      decoding="async"
                      width="149"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/37d2d1a1edcce15ca38c6021e882b6a7fff77ebb-149x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Stripe */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/d2404e7ff9893d2ff70751b73bde5cf5ff77a2eb-130x85.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Stripe logo"
                      loading="lazy"
                      decoding="async"
                      width="130"
                      height="85"
                      src="https://cdn.sanity.io/images/2hv88549/production/d2404e7ff9893d2ff70751b73bde5cf5ff77a2eb-130x85.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/beae7a1f5d7eb381a8729ea50e240ab0238d8b50-130x85.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Stripe logo"
                      loading="lazy"
                      decoding="async"
                      width="130"
                      height="85"
                      src="https://cdn.sanity.io/images/2hv88549/production/beae7a1f5d7eb381a8729ea50e240ab0238d8b50-130x85.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* PwC */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/2c23992784e4739fcbc987231055ff8e0b8a65b6-135x85.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="PwC logo"
                      loading="lazy"
                      decoding="async"
                      width="135"
                      height="85"
                      src="https://cdn.sanity.io/images/2hv88549/production/2c23992784e4739fcbc987231055ff8e0b8a65b6-135x85.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/27db0701c5730b006bf250146061410ea19e2cd1-135x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="PwC logo"
                      loading="lazy"
                      decoding="async"
                      width="135"
                      height="85"
                      src="https://cdn.sanity.io/images/2hv88549/production/27db0701c5730b006bf250146061410ea19e2cd1-135x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Figma */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/9f025cabdfa3dc225311f8b515349b7373316d20-128x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Figma logo"
                      loading="lazy"
                      decoding="async"
                      width="128"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/9f025cabdfa3dc225311f8b515349b7373316d20-128x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/105275382af564c3ab7ce401f92b3bcda4376bea-128x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Figma logo"
                      loading="lazy"
                      decoding="async"
                      width="128"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/105275382af564c3ab7ce401f92b3bcda4376bea-128x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Carlyle */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/fd11158b35335d544a9adc81564029bf1f7cf02e-183x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Carlyle logo"
                      loading="lazy"
                      decoding="async"
                      width="183"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/fd11158b35335d544a9adc81564029bf1f7cf02e-183x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/d05038b62e337c5dd6d5c6ec1db26602536f81c7-183x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Carlyle logo"
                      loading="lazy"
                      decoding="async"
                      width="183"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/d05038b62e337c5dd6d5c6ec1db26602536f81c7-183x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Sysco */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/711ad9f66f4f3e1559f469183c2cd2f55a64675a-130x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Sysco logo"
                      loading="lazy"
                      decoding="async"
                      width="130"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/711ad9f66f4f3e1559f469183c2cd2f55a64675a-130x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/9c161e562968d3e1c98e3f81593cf9f1222c1b9a-130x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Sysco logo"
                      loading="lazy"
                      decoding="async"
                      width="130"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/9c161e562968d3e1c98e3f81593cf9f1222c1b9a-130x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Deloitte */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/b2adb8636b742ba25b4ee5dd5188190036a28ab3-166x85.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Deloitte logo"
                      loading="lazy"
                      decoding="async"
                      width="166"
                      height="85"
                      src="https://cdn.sanity.io/images/2hv88549/production/b2adb8636b742ba25b4ee5dd5188190036a28ab3-166x85.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/1febd7dadfcb815d5fb5f810bd98b803bb5f441f-166x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Deloitte logo"
                      loading="lazy"
                      decoding="async"
                      width="166"
                      height="85"
                      src="https://cdn.sanity.io/images/2hv88549/production/1febd7dadfcb815d5fb5f810bd98b803bb5f441f-166x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Shopify */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/90b491460e3307e0b9812e61e5c24294e6ec11e9-178x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Shopify logo"
                      loading="lazy"
                      decoding="async"
                      width="178"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/90b491460e3307e0b9812e61e5c24294e6ec11e9-178x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/226f2d4fe8530384281bf70c1ce3905c812c4dd5-178x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Shopify logo"
                      loading="lazy"
                      decoding="async"
                      width="178"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/226f2d4fe8530384281bf70c1ce3905c812c4dd5-178x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Hilton */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/f7c1235d3b2cab983e46765485d23abfe98a2ef4-158x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Hilton logo"
                      loading="lazy"
                      decoding="async"
                      width="158"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/f7c1235d3b2cab983e46765485d23abfe98a2ef4-158x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/c69dc1fe995c5a289bf3d9c6eac5dc8cbde9ae6d-158x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Hilton logo"
                      loading="lazy"
                      decoding="async"
                      width="158"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/c69dc1fe995c5a289bf3d9c6eac5dc8cbde9ae6d-158x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* eBay */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/7d254b175c7b8d63c769f34b1d16a111b75fa881-125x85.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="eBay logo"
                      loading="lazy"
                      decoding="async"
                      width="125"
                      height="85"
                      src="https://cdn.sanity.io/images/2hv88549/production/7d254b175c7b8d63c769f34b1d16a111b75fa881-125x85.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/9374468754524c6ed74e013fa1c70288388b1ba6-125x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="eBay logo"
                      loading="lazy"
                      decoding="async"
                      width="125"
                      height="85"
                      src="https://cdn.sanity.io/images/2hv88549/production/9374468754524c6ed74e013fa1c70288388b1ba6-125x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* British Petroleum */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/42fb12996c10c6d346bc1464e48abfb176f22035-125x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="British Petroleum logo"
                      loading="lazy"
                      decoding="async"
                      width="125"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/42fb12996c10c6d346bc1464e48abfb176f22035-125x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/68e9bbc420a4a128a0c7673af4cdd3b0a8241e1d-125x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="British Petroleum logo"
                      loading="lazy"
                      decoding="async"
                      width="125"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/68e9bbc420a4a128a0c7673af4cdd3b0a8241e1d-125x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Mercado Libre */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/96449f570782fc441bd296873a95d9662aacb0d6-153x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Mercado Libre logo"
                      loading="lazy"
                      decoding="async"
                      width="153"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/96449f570782fc441bd296873a95d9662aacb0d6-153x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/46ae037bf51c4b1b7c04fa559d83ebcc1858fe6e-153x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Mercado Libre logo"
                      loading="lazy"
                      decoding="async"
                      width="153"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/46ae037bf51c4b1b7c04fa559d83ebcc1858fe6e-153x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Sanofi */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/e4faebbc0ff76010905d6ad567e7edcef9df64ac-135x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Sanofi logo"
                      loading="lazy"
                      decoding="async"
                      width="135"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/e4faebbc0ff76010905d6ad567e7edcef9df64ac-135x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/c8e4af8ee1e1a8cfc87309fa0bc0252b25c2bf08-135x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Sanofi logo"
                      loading="lazy"
                      decoding="async"
                      width="135"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/c8e4af8ee1e1a8cfc87309fa0bc0252b25c2bf08-135x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* British Airways */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/0f4ab94d171552d38069dfff156d4e5bbb65d61e-173x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="British airways logo"
                      loading="lazy"
                      decoding="async"
                      width="173"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/0f4ab94d171552d38069dfff156d4e5bbb65d61e-173x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/ff95a198b1af538e6def6c08c383ad9ec8f7df30-173x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="British airways logo"
                      loading="lazy"
                      decoding="async"
                      width="173"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/ff95a198b1af538e6def6c08c383ad9ec8f7df30-173x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Ramp */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/a07ff518beeee9fc023aeeb9028cf1236fe3763e-174x85.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Ramp logo"
                      loading="lazy"
                      decoding="async"
                      width="174"
                      height="85"
                      src="https://cdn.sanity.io/images/2hv88549/production/a07ff518beeee9fc023aeeb9028cf1236fe3763e-174x85.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/cf60827b1c3f341d19ef660f367bca517b0e74b9-174x85.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Ramp logo"
                      loading="lazy"
                      decoding="async"
                      width="174"
                      height="85"
                      src="https://cdn.sanity.io/images/2hv88549/production/cf60827b1c3f341d19ef660f367bca517b0e74b9-174x85.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Rivian */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/418e1184344c59cada5341ffd6da1987752bd8e8-203x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Rivian logo"
                      loading="lazy"
                      decoding="async"
                      width="203"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/418e1184344c59cada5341ffd6da1987752bd8e8-203x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/0d9d44b1c4cc2f84396d2503d15eaa2ccc6a8da2-203x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Rivian logo"
                      loading="lazy"
                      decoding="async"
                      width="203"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/0d9d44b1c4cc2f84396d2503d15eaa2ccc6a8da2-203x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Fox */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/f388c4543a13cdf5ea2445938c1eec90de62f03e-106x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Fox logo"
                      loading="lazy"
                      decoding="async"
                      width="106"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/f388c4543a13cdf5ea2445938c1eec90de62f03e-106x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/5a035e0a68626405115ec83259e3df365afb369a-106x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Fox logo"
                      loading="lazy"
                      decoding="async"
                      width="106"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/5a035e0a68626405115ec83259e3df365afb369a-106x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Budweiser */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/45eefda7f129ff7f910d9145772ab0bc17ab41ed-188x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Budweiser logo"
                      loading="lazy"
                      decoding="async"
                      width="188"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/45eefda7f129ff7f910d9145772ab0bc17ab41ed-188x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/75ab1e2cca72aa90a292928b4d64dc3dfb8a59a4-188x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Budweiser logo"
                      loading="lazy"
                      decoding="async"
                      width="188"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/75ab1e2cca72aa90a292928b4d64dc3dfb8a59a4-188x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
              {/* Lyft */}
              <div className="relative flex items-center justify-center">
                <div className="bg-card border border-border h-24 sm:h-28 md:h-32 px-3 flex w-full items-center justify-center rounded">
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/4502ae761bfeb8435fe8336abe6b6aaf6a31d524-90x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Lyft logo"
                      loading="lazy"
                      decoding="async"
                      width="90"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/4502ae761bfeb8435fe8336abe6b6aaf6a31d524-90x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="h-8 sm:h-9 md:h-10 w-auto object-contain hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/1524ae0ce348d57db89d4ba70c5c7aeb879ff837-90x84.svg?auto=format" />
                    <img
                      className="object-contain h-full w-full"
                      alt="Lyft logo"
                      loading="lazy"
                      decoding="async"
                      width="90"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/1524ae0ce348d57db89d4ba70c5c7aeb879ff837-90x84.svg?auto=format"
                    />
                  </picture>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ship better software section */}
      <section className="py-12 px-4 md:px-8 bg-background text-font pt-0 pb-0">
        <div className="container mx-auto mb-16">
          <div className="grid grid-rows-[auto_1fr]">
            <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-4 col-span-full row-span-full gap-y-0">
              <div className="col-span-full row-start-1 row-end-2 grid lg:row-start-1 lg:row-end-3 lg:items-center lg:col-start-1 lg:col-end-9 lg:pl-1 lg:pr-12">
                <div className="max-w-prose w-full lg:justify-self-start">
                  <div className="text-base flex-grow">
                    <h3 className="text-base md:text-lg text-pretty font-medium">
                      Ship better software, faster
                    </h3>
                    <div className="text-base md:text-lg text-muted-foreground text-pretty mt-2">
                      <p>
                        Cursor helps your entire engineering team deliver high-quality code faster.
                      </p>
                    </div>
                    <figure className="mt-4 border-border pl-6 border-l-2 pb-[2px]">
                      <blockquote>
                        <p className="text-base whitespace-pre-wrap text-pretty">
                          I&apos;ve never, as a CTO, received so many texts or Slack messages from
                          employees just saying &quot;Thank you for getting this technology
                          here.&quot;
                        </p>
                      </blockquote>
                      <div className="mt-4 flex items-center space-x-4">
                        <div className="h-[42px] w-[42px] shrink-0">
                          <picture className="block h-full w-full">
                            <img
                              className="object-cover h-full w-full rounded-full"
                              alt=""
                              loading="lazy"
                              decoding="async"
                              width="42"
                              height="42"
                              src="https://cdn.sanity.io/images/2hv88549/production/4ee11afa97d06ce1bff950e5ab761bbcd9abc26d-400x400.jpg?auto=format"
                            />
                          </picture>
                        </div>
                        <figcaption>
                          <div className="text-sm">
                            Melody Hildebrandt{' '}
                            <span className="text-sm text-muted-foreground block">CTO, Fox</span>
                          </div>
                        </figcaption>
                      </div>
                    </figure>
                  </div>
                </div>
              </div>
              <div className="max-lg:mt-7 col-span-full row-start-2 row-end-3 grid cursor-default items-end lg:row-start-1 lg:row-end-3 lg:items-center lg:col-start-9 lg:col-end-25">
                <div className="w-full h-[400px] p-4">
                  <MarketingProductPreview caption="Enterprise workspace preview" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Your engineering knowledge base Section */}
      <section className="py-12 px-4 md:px-8 bg-background text-font pt-0 pb-0">
        <div className="container mx-auto mb-16">
          <div className="grid grid-rows-[auto_1fr]">
            <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-4 col-span-full row-span-full gap-y-0">
              <div className="col-span-full row-start-1 row-end-2 grid lg:row-start-1 lg:row-end-3 lg:items-center lg:col-start-17 lg:col-end-25 lg:pr-1 lg:pl-12">
                <div className="max-w-prose w-full lg:justify-self-end">
                  <div className="text-base flex-grow">
                    <h3 className="text-base md:text-lg text-pretty font-medium">
                      Your engineering knowledge base
                    </h3>
                    <div className="text-base md:text-lg text-muted-foreground text-pretty mt-2">
                      <p>
                        Cursor Composer understands your entire codebase, making it easy to build
                        features across your stack.
                      </p>
                    </div>
                    <figure className="mt-4 border-border pl-6 border-l-2 pb-[2px]">
                      <blockquote>
                        <p className="text-base whitespace-pre-wrap text-pretty">
                          Across roles and levels, we&apos;re seeing an increase of over 25% in PR
                          volume and over 100% in the average PR size. Together, that means
                          we&apos;re shipping about 50% more code.
                        </p>
                      </blockquote>
                      <div className="mt-4 flex items-center space-x-4">
                        <div className="h-[42px] w-[42px] shrink-0">
                          <picture className="block h-full w-full">
                            <img
                              className="object-cover h-full w-full rounded-full"
                              alt=""
                              loading="lazy"
                              decoding="async"
                              width="42"
                              height="42"
                              src="https://cdn.sanity.io/images/2hv88549/production/c718dab25e4c0aa0b0ae01376883a056b6c10c3c-92x92.jpg?auto=format"
                            />
                          </picture>
                        </div>
                        <figcaption>
                          <div className="text-sm">
                            Anton Andreev{' '}
                            <span className="text-sm text-muted-foreground block">
                              Principal Software Engineer, Upwork
                            </span>
                          </div>
                        </figcaption>
                      </div>
                    </figure>
                  </div>
                </div>
              </div>
              <div className="max-lg:mt-7 col-span-full row-start-2 row-end-3 grid cursor-default items-end lg:row-start-1 lg:row-end-3 lg:items-center lg:col-start-1 lg:col-end-17">
                <div className="w-full h-[400px] p-4">
                  <MarketingProductPreview caption="Enterprise workspace preview" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Loved by developers Section */}
      <section className="py-12 px-4 md:px-8 bg-background text-font pt-0 pb-0">
        <div className="container mx-auto mb-16">
          <div className="grid grid-rows-[auto_1fr]">
            <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-4 col-span-full row-span-full gap-y-0">
              <div className="col-span-full row-start-1 row-end-2 grid lg:row-start-1 lg:row-end-3 lg:items-center lg:col-start-1 lg:col-end-9 lg:pl-1 lg:pr-12">
                <div className="max-w-prose w-full lg:justify-self-start">
                  <div className="text-base flex-grow">
                    <h3 className="text-base md:text-lg text-pretty font-medium">
                      Loved by developers
                    </h3>
                    <div className="text-base md:text-lg text-muted-foreground text-pretty mt-2">
                      <p>
                        Cursor is the most-loved AI coding tool, with a 4.9/5 rating from over
                        10,000 developers.
                      </p>
                    </div>
                    <figure className="mt-4 border-border pl-6 border-l-2 pb-[2px]">
                      <blockquote>
                        <p className="text-base whitespace-pre-wrap text-pretty">
                          What used to be a weeks-long ramp-up, navigating complex repos and
                          scheduling handoffs across global teams, is now a structured process built
                          around Cursor from day one.
                        </p>
                      </blockquote>
                      <div className="mt-4 flex items-center space-x-4">
                        <div className="h-[42px] w-[42px] shrink-0">
                          <picture className="block h-full w-full">
                            <img
                              className="object-cover h-full w-full rounded-full"
                              alt=""
                              loading="lazy"
                              decoding="async"
                              width="42"
                              height="42"
                              src="https://cdn.sanity.io/images/2hv88549/production/a3c852beb2163f2a225a7b81bedcd5b19a237845-400x400.jpg?auto=format"
                            />
                          </picture>
                        </div>
                        <figcaption>
                          <div className="text-sm">
                            Roni Avidov{' '}
                            <span className="text-sm text-muted-foreground block">
                              Senior R&D Team Lead, Monday
                            </span>
                          </div>
                        </figcaption>
                      </div>
                    </figure>
                  </div>
                </div>
              </div>
              <div className="max-lg:mt-7 col-span-full row-start-2 row-end-3 grid cursor-default items-end lg:row-start-1 lg:row-end-3 lg:items-center lg:col-start-9 lg:col-end-25">
                <div className="w-full h-[400px] p-4">
                  <MarketingProductPreview caption="Enterprise workspace preview" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-4 md:px-8 bg-background text-font">
        <div className="container mx-auto">
          <div className="flex flex-col gap-12">
            <div className="text-center mx-auto mb-8 max-w-[65ch]">
              <h2 className="text-2xl md:text-3xl text-balance mx-auto font-medium">
                Modern statistical analysis for enterprise research teams.
              </h2>
            </div>
            <div className="gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 md:aspect-[2/1] lg:aspect-video">
                <div className="col-span-full row-span-full flex flex-col">
                  <div className="mb-4 flex-grow">
                    <div className="text-4xl font-medium text-font">100+</div>
                  </div>
                  <div className="text-base text-font">
                    Concurrent users supported per enterprise organization.
                  </div>
                </div>
              </div>
              <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 md:aspect-[2/1] lg:aspect-video">
                <div className="col-span-full row-span-full flex flex-col">
                  <div className="mb-4 flex-grow">
                    <div className="text-4xl font-medium text-font">100,000+</div>
                  </div>
                  <div className="text-base text-font">
                    Statistical operations per month on enterprise plans.
                  </div>
                </div>
              </div>
              <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 md:aspect-[2/1] lg:aspect-video">
                <div className="col-span-full row-span-full flex flex-col">
                  <div className="mb-4 flex-grow">
                    <div className="text-4xl font-medium text-font">100 GB</div>
                  </div>
                  <div className="text-base text-font">
                    Data processed per month for enterprise teams.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-12 px-4 md:px-8" id="enterprise-security">
        <div className="container mx-auto">
          <div className="text-center mx-auto mb-8 max-w-prose">
            <h2 className="text-2xl md:text-3xl text-balance mx-auto font-medium mb-4">
              Trusted by companies worldwide
            </h2>
            <div className="flex justify-center">
              <div className="text-lg text-muted-foreground flex flex-col text-balance">
                <p>Built with security and compliance at the core.</p>
              </div>
            </div>
          </div>
        </div>
        <section className="py-12 px-4 md:px-8 bg-background text-font pt-0 pb-0">
          <div className="container mx-auto my-8">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-stretch mb-4">
              <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex h-full flex-col lg:min-h-[102.4px]">
                <div className="flex-grow">
                  <h2 className="text-base font-medium mb-2">Dedicated guidance</h2>
                  <div className="text-muted-foreground">
                    <p>Deploy AI at scale with professional expertise.</p>
                  </div>
                </div>
              </div>
              <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex h-full flex-col lg:min-h-[102.4px]">
                <div className="flex-grow">
                  <h2 className="text-base font-medium mb-2">Premium support</h2>
                  <div className="text-muted-foreground">
                    <p>Tailored support for teams with specialized needs.</p>
                  </div>
                </div>
              </div>
              <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex h-full flex-col lg:min-h-[102.4px]">
                <div className="flex-grow">
                  <h2 className="text-base font-medium mb-2">Zero data retention</h2>
                  <div className="text-muted-foreground">
                    <p>No training on your data by Cursor or LLM providers.</p>
                  </div>
                </div>
              </div>
              <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex h-full flex-col lg:min-h-[102.4px]">
                <div className="flex-grow">
                  <h2 className="text-base font-medium mb-2">Identity management</h2>
                  <div className="text-muted-foreground">
                    <p>SAML-based SSO integration for secure user access.</p>
                  </div>
                </div>
              </div>
              <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex h-full flex-col lg:min-h-[102.4px]">
                <div className="flex-grow">
                  <h2 className="text-base font-medium mb-2">SCIM user provisioning</h2>
                  <div className="text-muted-foreground">
                    <p>Easily create, update, and remove users and groups.</p>
                  </div>
                </div>
              </div>
              <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex h-full flex-col lg:min-h-[102.4px]">
                <div className="flex-grow">
                  <h2 className="text-base font-medium mb-2">Centralized security controls</h2>
                  <div className="text-muted-foreground">
                    <p>Configure model access, MCPs, and agent rules.</p>
                  </div>
                </div>
              </div>
              <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex h-full flex-col lg:min-h-[102.4px]">
                <div className="flex-grow">
                  <h2 className="text-base font-medium mb-2">Global compliance standards</h2>
                  <div className="text-muted-foreground">
                    <p>Compliant with the requirements of GDPR and CCPA.</p>
                  </div>
                </div>
              </div>
              <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex h-full flex-col lg:min-h-[102.4px]">
                <div className="flex-grow">
                  <h2 className="text-base font-medium mb-2">
                    Third-party security certifications
                  </h2>
                  <div className="text-muted-foreground">
                    <p>SOC 2 Type 2 certified and annual penetration testing.</p>
                  </div>
                </div>
              </div>
              <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex h-full flex-col lg:min-h-[102.4px]">
                <div className="flex-grow">
                  <h2 className="text-base font-medium mb-2">Robust data protection</h2>
                  <div className="text-muted-foreground">
                    <p>AES-256 encryption at rest and TLS 1.2+ in transit.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div className="mt-10 container mx-auto">
          <div className="text-center mx-auto max-w-[65ch]">
            <div className="flex items-center justify-center gap-4 mt-10">
              <Link
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium rounded-full transition-all bg-[var(--color-button-primary-bg)] border border-[var(--color-button-primary-border)] text-[var(--color-button-primary-text)] hover:opacity-90"
                href="https://trust.cursor.com"
              >
                Visit our Trust Center
                <span className="ml-2" aria-hidden="true">
                  ↗
                </span>
              </Link>
              <Link
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium rounded-full transition-all border border-border bg-secondary text-secondary-foreground hover:bg-hover"
                href="/security"
              >
                Read about our security
                <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Powerful, yet customizable Section */}
      <section className="py-12 px-4 md:px-8">
        <div className="container mx-auto">
          <div className="text-left mb-8 max-w-prose">
            <h2 className="text-2xl md:text-3xl text-balance font-medium mb-4">
              Powerful, yet customizable
            </h2>
            <div className="flex justify-start mb-4">
              <div className="text-lg text-muted-foreground flex flex-col text-balance">
                <p>
                  Standardize your research team on the same statistical analysis tools and best
                  practices.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-start gap-4">
              <Link
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium rounded-full transition-all bg-[var(--color-button-primary-bg)] border border-[var(--color-button-primary-border)] text-[var(--color-button-primary-text)] hover:opacity-90"
                href="/contact-sales"
              >
                Contact sales
              </Link>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <section className="py-12 px-4 md:px-8 bg-background text-font pt-0 pb-0">
          <div className="container mx-auto my-8">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-stretch mb-4">
              <Link
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex h-full flex-grow flex-col"
                href="https://docs.cursor.com/account/teams/enterprise-settings"
              >
                <div className="text-base flex max-w-prose flex-grow flex-col justify-between">
                  <div>
                    <h2 className="text-base font-medium mb-2">Total control</h2>
                    <div className="text-muted-foreground text-pretty">
                      <p>
                        Globally configure model access, MCP controls, and system-level agent rules.
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full transition-all border border-border bg-transparent text-font no-underline hover:bg-hover">
                      View enterprise controls ↗
                    </span>
                  </div>
                </div>
              </Link>
              <Link
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex h-full flex-grow flex-col"
                href="https://docs.cursor.com/models"
              >
                <div className="text-base flex max-w-prose flex-grow flex-col justify-between">
                  <div>
                    <h2 className="text-base font-medium mb-2">Advanced statistical methods</h2>
                    <div className="text-muted-foreground text-pretty">
                      <p>
                        Access comprehensive statistical methods from descriptive statistics to
                        Structural Equation Modeling and machine learning.
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full transition-all border border-border bg-transparent text-font no-underline hover:bg-hover">
                      View all methods →
                    </span>
                  </div>
                </div>
              </Link>
              <Link
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex h-full flex-grow flex-col"
                href="/features"
              >
                <div className="text-base flex max-w-prose flex-grow flex-col justify-between">
                  <div>
                    <h2 className="text-base font-medium mb-2">Plugin architecture</h2>
                    <div className="text-muted-foreground text-pretty">
                      <p>
                        Extend Tensr with custom plugins and integrate with external data sources
                        and analysis tools.
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full transition-all border border-border bg-transparent text-font no-underline hover:bg-hover">
                      Learn about plugins →
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>
      </section>

      {/* Testimonials Section */}
      <section className="py-12 px-4 md:px-8 bg-background text-font">
        <div className="container mx-auto">
          <div className="text-center mx-auto mb-8 max-w-[65ch]">
            <h2 className="text-2xl md:text-3xl text-balance mx-auto font-medium">
              Research teams trust Tensr for enterprise statistical analysis.
            </h2>
          </div>
          <div className="gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Stripe Testimonial */}
            <div className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 md:aspect-[2/1] lg:aspect-[8/5]">
              <figure className="flex flex-col col-span-full row-span-full">
                <div className="mb-4 flex w-full max-w-[200px] shrink items-start">
                  <picture className="block dark:hidden">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/360c18e5d27a0f5283f76742624c9ee05cc716f0-130x84.svg?auto=format" />
                    <img
                      className="h-auto max-h-[40px] w-auto max-w-full shrink-0 object-contain object-left"
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width="130"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/360c18e5d27a0f5283f76742624c9ee05cc716f0-130x84.svg?auto=format"
                    />
                  </picture>
                  <picture className="hidden dark:block">
                    <source srcSet="https://cdn.sanity.io/images/2hv88549/production/95f6c20eca76089b9775811014d698075a584264-130x84.svg?auto=format" />
                    <img
                      className="h-auto max-h-[40px] w-auto max-w-full shrink-0 object-contain object-left"
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width="130"
                      height="84"
                      src="https://cdn.sanity.io/images/2hv88549/production/95f6c20eca76089b9775811014d698075a584264-130x84.svg?auto=format"
                    />
                  </picture>
                </div>
                <blockquote className="flex-grow">
                  <p className="text-base whitespace-pre-wrap">
                    Cursor quickly grew from hundreds to thousands of extremely enthusiastic Stripe
                    employees. We spend more on R&D and software creation than any other
                    undertaking, and there&apos;s significant economic outcomes when making that
                    process more efficient and productive.
                  </p>
                </blockquote>
                <div className="mt-8 flex items-center space-x-4">
                  <div className="h-10 w-10 shrink-0">
                    <picture className="block h-full w-full">
                      <img
                        className="object-cover h-full w-full rounded-full"
                        alt="Patrick Collison"
                        loading="lazy"
                        decoding="async"
                        width="40"
                        height="40"
                        src="https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format"
                      />
                    </picture>
                  </div>
                  <figcaption>
                    <div className="text-sm">
                      Patrick Collison{' '}
                      <span className="text-sm text-muted-foreground block">
                        Co‑Founder & CEO, Stripe
                      </span>
                    </div>
                  </figcaption>
                </div>
              </figure>
            </div>
            {/* Add more testimonials here if needed */}
          </div>
        </div>
        <div className="mt-10 container mx-auto px-4">
          <div className="text-center mx-auto max-w-prose">
            <div className="flex items-center justify-center gap-4 mt-10">
              <Link
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium rounded-full transition-all bg-[var(--color-button-primary-bg)] border border-[var(--color-button-primary-border)] text-[var(--color-button-primary-text)] hover:opacity-90"
                href="/contact-sales"
              >
                Bring Tensr to your team
                <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Latest from Cursor Section */}
      <section className="py-12 px-4 md:px-8 bg-background text-font">
        <div className="container mx-auto">
          <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0">
            <div className="col-span-full md:col-start-1 md:col-end-7 lg:col-start-1 lg:col-end-9 xl:col-start-1 xl:col-end-7">
              <h2 className="text-base text-font mb-4 sticky top-[72px] lg:mb-0 font-medium">
                Latest from Tensr
              </h2>
            </div>
            <div className="col-span-full md:col-start-7 md:col-end-25 lg:col-start-9 lg:col-end-25 xl:col-start-7 xl:col-end-19">
              <article className="flex flex-grow flex-col mb-4">
                <Link
                  className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex-grow grid grid-cols-[1fr_auto] gap-4"
                  href="/blog/series-d"
                >
                  <div className="flex flex-col">
                    <div className="flex-grow">
                      <p className="text-base text-font text-pretty font-medium">
                        Past, Present, and Future
                      </p>
                      <p className="text-base text-muted-foreground text-pretty mt-2">
                        We raised our Series D of $2.3B and have passed $1B in annualized revenue.
                      </p>
                    </div>
                    <div className="mt-4 text-muted-foreground flex shrink-0 items-center">
                      <span className="capitalize">company&nbsp;·&nbsp;</span>
                      <time dateTime="2025-11-13T11:27:11.894Z" className="text-base">
                        Nov 13, 2025
                      </time>
                    </div>
                  </div>
                </Link>
              </article>
              <article className="flex flex-grow flex-col mb-4">
                <Link
                  className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex-grow grid grid-cols-[1fr_auto] gap-4"
                  href="/blog/productivity"
                >
                  <div className="flex flex-col">
                    <div className="flex-grow">
                      <p className="text-base text-font text-pretty font-medium">
                        The productivity impact of coding agents
                      </p>
                      <p className="text-base text-muted-foreground text-pretty mt-2">
                        A new study from the University of Chicago finds that companies merge 39%
                        more PRs after Cursor&apos;s agent became the default.
                      </p>
                    </div>
                    <div className="mt-4 text-muted-foreground flex shrink-0 items-center">
                      <span className="capitalize">research&nbsp;·&nbsp;</span>
                      <time dateTime="2025-11-11T17:37:00.000Z" className="text-base">
                        Nov 11, 2025
                      </time>
                    </div>
                  </div>
                </Link>
              </article>
              <article className="flex flex-grow flex-col">
                <Link
                  className="block bg-card border border-border rounded transition-all hover:bg-hover p-6 flex-grow grid grid-cols-[1fr_auto] gap-4"
                  href="/blog/2-0"
                >
                  <div className="flex flex-col">
                    <div className="flex-grow">
                      <p className="text-base text-font text-pretty font-medium">
                        Introducing Cursor 2.0 and Composer
                      </p>
                      <p className="text-base text-muted-foreground text-pretty mt-2">
                        A new interface and our first coding model, both purpose-built for working
                        with agents.
                      </p>
                    </div>
                    <div className="mt-4 text-muted-foreground flex shrink-0 items-center">
                      <span className="capitalize">product&nbsp;·&nbsp;</span>
                      <time dateTime="2025-10-29T04:54:48.600Z" className="text-base">
                        Oct 29, 2025
                      </time>
                    </div>
                  </div>
                </Link>
              </article>
              <Link
                className="inline-flex items-center text-primary no-underline transition-opacity hover:opacity-80 mt-4"
                href="/blog"
              >
                View more posts →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Q&A Section */}
      <section className="py-12 px-4 md:px-8 bg-card text-font">
        <div className="container mx-auto">
          <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0">
            <div className="col-span-full lg:col-end-7">
              <div className="sticky top-[72px] max-lg:mb-8">
                <h2 className="text-2xl md:text-3xl text-pretty font-medium">
                  Questions & Answers
                </h2>
              </div>
            </div>
            <div className="col-span-full lg:col-start-7 lg:col-end-[-1]">
              <Accordion items={qaItems} />
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-32 md:py-48 px-4 md:px-8 bg-background text-font">
        <div className="container mx-auto">
          <div className="text-center mx-auto">
            <h2 className="text-6xl sm:text-7xl font-normal text-balance mx-auto mb-4">
              Get started with Tensr Enterprise.
            </h2>
            <div className="flex items-center justify-center gap-4">
              <Link
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium rounded-full transition-all bg-[var(--color-button-primary-bg)] border border-[var(--color-button-primary-border)] text-[var(--color-button-primary-text)] hover:opacity-90"
                href="/contact-sales"
              >
                Contact sales
                <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default EnterpriseTemplate;
