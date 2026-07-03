'use client';

import Link from 'next/link';
import { FrequencyToggle } from '@/components/templates/marketing/components/frequency-toggle';
import { Accordion } from '@/components/templates/marketing/components/accordion';
import { useState } from 'react';

export const PricingTemplate = () => {
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('monthly');

  const qaItems = [
    {
      id: 'q1',
      question: 'Who qualifies for the Education plan?',
      answer:
        'The Education plan is available free of charge to anyone with a valid university email address.',
    },
    {
      id: 'q2',
      question: "What's included in the base statistical package?",
      answer:
        'The base package includes all standard analysis functionality including descriptive statistics, regression analysis, factor analysis, and basic visualization tools.',
    },
    {
      id: 'q3',
      question: 'How does the Team plan work?',
      answer:
        'The Team plan supports up to 5 users with full collaboration features, shared workspaces, and version control. Perfect for small research teams or departments.',
    },
    {
      id: 'q4',
      question: 'Do I get access to new features automatically?',
      answer:
        "Yes! Paid plans (Professional, Team, and Enterprise) automatically get access to new features as they're released.",
    },
    {
      id: 'q5',
      question: 'Can I upgrade from Education to a paid plan?',
      answer:
        'Yes, you can upgrade from an Education plan to any paid plan at any time while keeping all your existing analyses and data.',
    },
    {
      id: 'q6',
      question: 'Is there a limit on dataset size?',
      answer:
        "No, there are no artificial limits on dataset size. Performance will depend on your computer's specifications as this is a cloud-native application.",
    },
    {
      id: 'q7',
      question: 'What happens to my analyses if I downgrade?',
      answer:
        "You'll maintain access to all your existing analyses, but features specific to higher tiers will become unavailable.",
    },
    {
      id: 'q8',
      question: 'Do you offer training and onboarding?',
      answer:
        'Yes, we offer basic training resources for all users, with additional custom training options for Team and Enterprise plans.',
    },
  ];

  return (
    <>
      <section
        className="py-12 bg-background text-font mb-4"
        data-sanity="id=9da2f560-301e-4713-8113-bbaa85c4b14c;type=pricingPage;path=pageBuilder;base=http%3A%2F%2Flocalhost%3A3333"
      >
        <div className="container mx-auto">
          <h1 className="text-4xl text-center">Pricing</h1>
          <div className="mt-4 flex justify-center">
            <FrequencyToggle value={frequency} onChange={setFrequency} />
          </div>

          {/* Individual Plans */}
          <div className="mt-12 space-y-8">
            <h2 id="individual" className="text-xl font-medium">
              <a href="#individual" className="hover:opacity-90">
                Individual Plans
              </a>
            </h2>
            <div className="gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              {/* Education */}
              <Link
                className="block bg-card border border-border rounded-sm transition-all hover:bg-hover p-6 md:aspect-video lg:aspect-[4/5]"
                href="https://app.tensr.xyz"
              >
                <div className="col-span-full row-span-full flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-baseline gap-x-2">
                      <h3 className="text-lg" id="tier-0-0">
                        Education
                      </h3>
                    </div>
                    <p className="flex items-baseline">
                      <span className="text-lg text-muted-foreground">Free</span>
                    </p>
                    <p className="text-muted-foreground mt-3">Includes:</p>
                    <ul role="list" className="mt-3 space-y-0.5">
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Complete statistical analysis suite</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Data preparation and cleaning tools</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Basic research methods package</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>100 operations/month</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>100 MB data processed</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Single user license</span>
                      </li>
                    </ul>
                  </div>
                  <div className="mt-6">
                    <span className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full transition-all border-none cursor-pointer bg-secondary text-secondary-foreground hover:opacity-90">
                      Get started
                    </span>
                  </div>
                </div>
              </Link>

              {/* Professional */}
              <Link
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-card border border-border rounded-sm transition-all hover:bg-hover p-6 md:aspect-video lg:aspect-[4/5]"
                href="https://app.tensr.xyz"
              >
                <div className="col-span-full row-span-full flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-baseline gap-x-2">
                      <h3 className="text-lg" id="tier-0-1">
                        Professional
                      </h3>
                    </div>
                    <p className="flex items-baseline">
                      <span className="text-lg text-muted-foreground">
                        £{frequency === 'monthly' ? '20' : '200'}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {' '}
                        / {frequency === 'monthly' ? 'mo.' : 'yr.'}
                      </span>
                    </p>
                    <p className="text-muted-foreground mt-3">Everything in Education, plus:</p>
                    <ul role="list" className="mt-3 space-y-0.5">
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Advanced statistical methods</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Enhanced visualization capabilities</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Advanced data transformation</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>1,000 operations/month</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>1 GB data processed</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>3 concurrent users</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>API integrations</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>7-day free trial</span>
                      </li>
                    </ul>
                  </div>
                  <div className="mt-6">
                    <span className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full transition-all border-none cursor-pointer bg-secondary text-secondary-foreground hover:opacity-90">
                      Get Professional
                    </span>
                  </div>
                </div>
              </Link>

              {/* Team - Recommended */}
              <Link
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-card border border-border rounded-sm transition-all hover:bg-hover p-6 md:aspect-video lg:aspect-[4/5]"
                href="https://app.tensr.xyz"
              >
                <div className="col-span-full row-span-full flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-baseline gap-x-2">
                      <h3 className="text-lg" id="tier-0-2">
                        Team
                      </h3>
                      <p className="text-primary">Recommended</p>
                    </div>
                    <p className="flex items-baseline">
                      <span className="text-lg text-muted-foreground">
                        £{frequency === 'monthly' ? '99' : '990'}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {' '}
                        / {frequency === 'monthly' ? 'mo.' : 'yr.'}
                      </span>
                    </p>
                    <p className="text-muted-foreground mt-3">Everything in Professional, plus:</p>
                    <ul role="list" className="mt-3 space-y-0.5">
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Team collaboration (up to 5 users)</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Shared workspaces</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Version control</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>10,000 operations/month</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>10 GB data processed</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>10 concurrent users</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Real-time collaboration</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>7-day free trial</span>
                      </li>
                    </ul>
                  </div>
                  <div className="mt-6">
                    <span className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full transition-all border-none cursor-pointer bg-primary text-primary-foreground hover:opacity-90">
                      Get Team
                    </span>
                  </div>
                </div>
              </Link>

              {/* Enterprise */}
              <Link
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-card border border-border rounded-sm transition-all hover:bg-hover p-6 md:aspect-video lg:aspect-[4/5]"
                href="/enterprise"
              >
                <div className="col-span-full row-span-full flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-baseline gap-x-2">
                      <h3 className="text-lg" id="tier-0-3">
                        Enterprise
                      </h3>
                    </div>
                    <p className="flex items-baseline">
                      <span className="text-lg text-muted-foreground">Custom</span>
                    </p>
                    <p className="text-muted-foreground mt-3">Everything in Team, plus:</p>
                    <ul role="list" className="mt-3 space-y-0.5">
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Unlimited team size</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Enhanced security features</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>100,000 operations/month</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>100 GB data processed</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>100 concurrent users</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Custom API integrations</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>Custom deployment options</span>
                      </li>
                      <li className="gap-x-3 flex">
                        <span>✓</span>
                        <span>14-day free trial</span>
                      </li>
                    </ul>
                  </div>
                  <div className="mt-6">
                    <span className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full transition-all border-none cursor-pointer bg-secondary text-secondary-foreground hover:opacity-90">
                      Contact Sales
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Logo Garden Section */}
      <section
        className="py-12 bg-background text-font pb-6 pt-0"
        id="logo-garden"
        data-sanity="id=9da2f560-301e-4713-8113-bbaa85c4b14c;type=pricingPage;path=pageBuilder:16f82dbb1e74;base=http%3A%2F%2Flocalhost%3A3333"
      >
        <div className="flex flex-col container mx-auto text-center">
          <h2 className="text-sm mb-4">Trusted by researchers and data scientists worldwide.</h2>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
            {/* Stripe */}
            <div className="relative flex items-center justify-center">
              <div className="bg-card border border-border h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain block dark:hidden">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/d2404e7ff9893d2ff70751b73bde5cf5ff77a2eb-130x85.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="Stripe logo"
                    loading="lazy"
                    decoding="async"
                    width="130"
                    height="85"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/d2404e7ff9893d2ff70751b73bde5cf5ff77a2eb-130x85.svg?auto=format"
                  />
                </picture>
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain hidden dark:block">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/beae7a1f5d7eb381a8729ea50e240ab0238d8b50-130x85.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="Stripe logo"
                    loading="lazy"
                    decoding="async"
                    width="130"
                    height="85"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/beae7a1f5d7eb381a8729ea50e240ab0238d8b50-130x85.svg?auto=format"
                  />
                </picture>
              </div>
            </div>
            {/* OpenAI */}
            <div className="relative flex items-center justify-center">
              <div className="bg-card border border-border h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain block dark:hidden">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/a733e7c0b6d2a19f7769d1d327781dc74f577f49-159x84.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="OpenAI Logo"
                    loading="lazy"
                    decoding="async"
                    width="159"
                    height="84"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/a733e7c0b6d2a19f7769d1d327781dc74f577f49-159x84.svg?auto=format"
                  />
                </picture>
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain hidden dark:block">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/53062f7690ae5b0cdbed3ea686fcea9da8b0b0b6-159x84.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="OpenAI Logo"
                    loading="lazy"
                    decoding="async"
                    width="159"
                    height="84"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/53062f7690ae5b0cdbed3ea686fcea9da8b0b0b6-159x84.svg?auto=format"
                  />
                </picture>
              </div>
            </div>
            {/* Linear */}
            <div className="relative flex items-center justify-center">
              <div className="bg-card border border-border h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain block dark:hidden">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/6f626e50f09b9272363eb3067f871533eaf116ed-188x85.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="Linear logo"
                    loading="lazy"
                    decoding="async"
                    width="188"
                    height="85"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/6f626e50f09b9272363eb3067f871533eaf116ed-188x85.svg?auto=format"
                  />
                </picture>
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain hidden dark:block">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/eb9e0a5931092d4db1ddda33106d16b7ef6b0829-188x85.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="Linear logo"
                    loading="lazy"
                    decoding="async"
                    width="188"
                    height="85"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/eb9e0a5931092d4db1ddda33106d16b7ef6b0829-188x85.svg?auto=format"
                  />
                </picture>
              </div>
            </div>
            {/* Datadog */}
            <div className="relative flex items-center justify-center">
              <div className="bg-card border border-border h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain block dark:hidden">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/f44dd77a6265aa8b77768cddfa25bb4a60cd13c9-201x84.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="Datadog logo"
                    loading="lazy"
                    decoding="async"
                    width="201"
                    height="84"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/f44dd77a6265aa8b77768cddfa25bb4a60cd13c9-201x84.svg?auto=format"
                  />
                </picture>
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain hidden dark:block">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/da55192921531e5fd2ba00701f4bf6ffd8b1781d-196x84.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="Datadog logo"
                    loading="lazy"
                    decoding="async"
                    width="201"
                    height="84"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/da55192921531e5fd2ba00701f4bf6ffd8b1781d-196x84.svg?auto=format"
                  />
                </picture>
              </div>
            </div>
            {/* Rippling */}
            <div className="relative flex items-center justify-center">
              <div className="bg-card border border-border h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain block dark:hidden">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/440e543f9a7e5b9d196a9b3662a9e0e895362f05-232x84.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="Rippling logo"
                    loading="lazy"
                    decoding="async"
                    width="232"
                    height="84"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/440e543f9a7e5b9d196a9b3662a9e0e895362f05-232x84.svg?auto=format"
                  />
                </picture>
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain hidden dark:block">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/a51bba3a29e4471cb49ec7c9692990e69bffcb0d-232x84.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="Rippling logo"
                    loading="lazy"
                    decoding="async"
                    width="232"
                    height="84"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/a51bba3a29e4471cb49ec7c9692990e69bffcb0d-232x84.svg?auto=format"
                  />
                </picture>
              </div>
            </div>
            {/* Figma */}
            <div className="relative flex items-center justify-center">
              <div className="bg-card border border-border h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain block dark:hidden">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/9f025cabdfa3dc225311f8b515349b7373316d20-128x84.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="Figma logo"
                    loading="lazy"
                    decoding="async"
                    width="128"
                    height="84"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/9f025cabdfa3dc225311f8b515349b7373316d20-128x84.svg?auto=format"
                  />
                </picture>
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain hidden dark:block">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/105275382af564c3ab7ce401f92b3bcda4376bea-128x84.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="Figma logo"
                    loading="lazy"
                    decoding="async"
                    width="128"
                    height="84"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/105275382af564c3ab7ce401f92b3bcda4376bea-128x84.svg?auto=format"
                  />
                </picture>
              </div>
            </div>
            {/* Ramp */}
            <div className="relative flex items-center justify-center">
              <div className="bg-card border border-border h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain block dark:hidden">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/a07ff518beeee9fc023aeeb9028cf1236fe3763e-174x85.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="Ramp logo"
                    loading="lazy"
                    decoding="async"
                    width="174"
                    height="85"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/a07ff518beeee9fc023aeeb9028cf1236fe3763e-174x85.svg?auto=format"
                  />
                </picture>
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain hidden dark:block">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/cf60827b1c3f341d19ef660f367bca517b0e74b9-174x85.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="Ramp logo"
                    loading="lazy"
                    decoding="async"
                    width="174"
                    height="85"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/cf60827b1c3f341d19ef660f367bca517b0e74b9-174x85.svg?auto=format"
                  />
                </picture>
              </div>
            </div>
            {/* Adobe */}
            <div className="relative flex items-center justify-center">
              <div className="bg-card border border-border h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain block dark:hidden">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/bdc0f1bd4dfe8115422533f560f9f3eef7f23ac7-149x84.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="Adobe logo"
                    loading="lazy"
                    decoding="async"
                    width="149"
                    height="84"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/bdc0f1bd4dfe8115422533f560f9f3eef7f23ac7-149x84.svg?auto=format"
                  />
                </picture>
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain hidden dark:block">
                  <source srcSet="https://cdn.sanity.io/images/2hv88549/production/37d2d1a1edcce15ca38c6021e882b6a7fff77ebb-149x84.svg?auto=format" />
                  <img
                    className="object-contain h-full w-full"
                    alt="Adobe logo"
                    loading="lazy"
                    decoding="async"
                    width="149"
                    height="84"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/37d2d1a1edcce15ca38c6021e882b6a7fff77ebb-149x84.svg?auto=format"
                  />
                </picture>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Q&A Section */}
      <section
        className="py-12 bg-background text-font"
        data-sanity="id=9da2f560-301e-4713-8113-bbaa85c4b14c;type=pricingPage;path=pageBuilder:35c039ef7ea4;base=http%3A%2F%2Flocalhost%3A3333"
      >
        <div className="container mx-auto">
          <div className="grid grid-cols-12 gap-4 gap-0">
            <div className="col-span-full lg:col-end-7">
              <div className="sticky top-[72px] max-lg:mb-8">
                <h2 className="text-2xl text-pretty">Questions & Answers</h2>
              </div>
            </div>
            <div className="col-span-full lg:col-start-7 lg:col-end-[-1]">
              <Accordion items={qaItems} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default PricingTemplate;
