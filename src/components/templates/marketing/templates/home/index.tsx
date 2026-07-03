'use client';

import { MarketingProductPreview } from '@/components/templates/marketing/marketing-product-preview';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const HomeTemplate = () => {
  return (
    <main
      id="main"
      data-sanity="id=homepage;type=page;path=pageBuilder;base=http%3A%2F%2Flocalhost%3A3333"
    >
      <section className="py-12 px-4 md:px-8 bg-background text-font">
        <div className="container mx-auto">
          <div className="text-left mb-10 max-w-prose">
            <h1 className="text-2xl md:text-3xl font-normal leading-tight tracking-tight text-balance mb-4">
              Modern statistical analysis platform built for researchers and data scientists.
            </h1>
            <div className="gap-x-4 flex items-center justify-start">
              <div className="space-y-1">
                <div className="hidden md:block">
                  <Link
                    href="https://app.tensr.xyz"
                    className="inline-flex items-center px-6 py-3 bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] rounded-full hover:opacity-90 transition-colors text-sm font-medium"
                  >
                    Get started
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
                <div className="block md:hidden">
                  <Link
                    href="https://app.tensr.xyz"
                    className="inline-flex items-center px-6 py-3 bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] rounded-full hover:opacity-90 transition-colors text-sm font-medium"
                  >
                    Get started
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-sm overflow-hidden z-10">
            <div className="relative z-10 col-span-full row-span-full overflow-hidden">
              <picture className="absolute inset-0 brightness-90">
                <source
                  media="(min-width: 901px)"
                  srcSet="https://cdn.sanity.io/images/2hv88549/production/cc24ca462279ca23250c6953612a9e3fd9838355-6360x4240.jpg?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/cc24ca462279ca23250c6953612a9e3fd9838355-6360x4240.jpg?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/cc24ca462279ca23250c6953612a9e3fd9838355-6360x4240.jpg?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/cc24ca462279ca23250c6953612a9e3fd9838355-6360x4240.jpg?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/cc24ca462279ca23250c6953612a9e3fd9838355-6360x4240.jpg?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/cc24ca462279ca23250c6953612a9e3fd9838355-6360x4240.jpg?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/cc24ca462279ca23250c6953612a9e3fd9838355-6360x4240.jpg?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/cc24ca462279ca23250c6953612a9e3fd9838355-6360x4240.jpg?auto=format&w=3840 3840w"
                />
                <img
                  className="object-cover h-full w-full"
                  alt=""
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  src="https://cdn.sanity.io/images/2hv88549/production/cc24ca462279ca23250c6953612a9e3fd9838355-6360x4240.jpg?auto=format"
                />
              </picture>
            </div>
            <div className="z-20 col-span-full row-span-full">
              {/* Demo window content - simplified for now, can be enhanced later */}
              <div
                className="relative w-full overflow-hidden select-none border border-border rounded-sm"
                style={{
                  height: 'min(780px, 70vh)',
                  minHeight: '680px',
                }}
              >
                <div className="absolute top-0 right-0 bottom-0 left-0 z-10 h-full w-full max-[767px]:pointer-events-none max-[767px]:opacity-0 transition-opacity duration-150">
                  <div className="sr-only" aria-live="polite">
                    This element contains an interactive demo for sighted users showing the Tensr
                    statistical analysis platform with data visualization, analysis tools, and
                    collaborative features.
                  </div>
                  {/* Demo window structure - placeholder for now */}
                  <div className="absolute inset-0 p-4">
                    <MarketingProductPreview />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logo Garden Section */}
      <section
        className="py-12 px-4 md:px-8 bg-background text-font pb-6 pt-0"
        id="logo-garden"
        data-sanity="id=homepage;type=page;path=pageBuilder:8f9fe88f4ff9;base=http%3A%2F%2Flocalhost%3A3333"
      >
        <div className="container mx-auto text-center flex flex-col gap-4">
          <h2 className="text-sm mb-4">Trusted by researchers and data scientists worldwide.</h2>
          <div className="grid grid-rows-2 grid-cols-4 gap-3 sm:gap-4 md:grid-rows-1 md:grid-cols-8">
            {/* Stripe */}
            <div className="relative flex items-center justify-center">
              <div className="relative bg-card h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded-sm">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain dark:hidden">
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
              <div className="relative bg-card h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded-sm">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain dark:hidden">
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
              <div className="relative bg-card h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded-sm">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain dark:hidden">
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
              <div className="relative bg-card h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded-sm">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain dark:hidden">
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
              <div className="relative bg-card h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded-sm">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain dark:hidden">
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
              <div className="relative bg-card h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded-sm">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain dark:hidden">
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
              <div className="relative bg-card h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded-sm">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain dark:hidden">
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
              <div className="relative bg-card h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded-sm">
                <picture className="h-[2rem] sm:h-[2.25rem] md:h-[2.5rem] w-auto object-contain dark:hidden">
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

      {/* Feature Sections */}
      <section
        className="py-12 px-4 md:px-8"
        data-sanity="id=homepage;type=page;path=pageBuilder:708e87e25e85;base=http%3A%2F%2Flocalhost%3A3333"
      >
        {/* Agent Feature */}
        <section
          className="py-12 px-4 md:px-8 bg-background text-font"
          data-sanity="id=homepage;type=page;path=pageBuilder:094503c667c5;base=http%3A%2F%2Flocalhost%3A3333"
        >
          <div className="container mx-auto mb-16">
            <div className="grid grid-rows-[auto_1fr]">
              <Link
                className="group bg-card border border-border rounded-lg p-6 col-span-full row-span-full gap-y-0 max-lg:grid-rows-subgrid"
                href="/features#agent"
              >
                <div className="col-span-full row-start-1 row-end-2 grid lg:row-start-1 lg:row-end-3 lg:items-center lg:col-start-1 lg:col-end-9 lg:pl-g0.25 lg:pr-g3">
                  <div className="max-w-2xl w-full lg:justify-self-start">
                    <div className="text-base flex-1">
                      <h3 className="text-base md:text-lg font-medium text-pretty">
                        Complete statistical analysis suite
                      </h3>
                      <div className="text-base md:text-lg text-muted-foreground text-pretty">
                        <p>
                          Powerful tools for data analysis, from descriptive statistics to advanced
                          methods like Structural Equation Modeling.
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="text-primary group-hover:underline inline-flex items-center gap-1">
                        Learn about our features →
                      </span>
                    </div>
                  </div>
                </div>
                <div className="max-lg:mt-g1.75 col-span-full row-start-2 row-end-3 grid cursor-default items-end lg:row-start-1 lg:row-end-3 lg:items-center lg:col-start-9 lg:col-end-25"></div>
              </Link>
              <div className="p-7 col-span-full row-span-full gap-y-0 max-lg:grid-rows-subgrid">
                <div className="col-span-full row-start-1 row-end-2 grid lg:row-start-1 lg:row-end-2 lg:items-center lg:col-start-1 lg:col-end-9 lg:pl-g0.25 lg:pr-g3"></div>
                <div className="max-lg:pt-v1 col-span-full row-start-2 row-end-3 grid cursor-default items-end lg:row-start-2 lg:row-end-3 lg:items-center lg:col-start-9 lg:col-end-25">
                  <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-lg">
                    <div className="relative z-1 col-span-full row-span-full overflow-hidden">
                      <picture className="absolute inset-0 scale-[1.1] transform brightness-90">
                        <source
                          media="(min-width: 901px)"
                          srcSet="https://cdn.sanity.io/images/2hv88549/production/d3c8107d95ae7f6604adf275457656c68d117b2a-2515x1677.jpg?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/d3c8107d95ae7f6604adf275457656c68d117b2a-2515x1677.jpg?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/d3c8107d95ae7f6604adf275457656c68d117b2a-2515x1677.jpg?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/d3c8107d95ae7f6604adf275457656c68d117b2a-2515x1677.jpg?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/d3c8107d95ae7f6604adf275457656c68d117b2a-2515x1677.jpg?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/d3c8107d95ae7f6604adf275457656c68d117b2a-2515x1677.jpg?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/d3c8107d95ae7f6604adf275457656c68d117b2a-2515x1677.jpg?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/d3c8107d95ae7f6604adf275457656c68d117b2a-2515x1677.jpg?auto=format&w=3840 3840w"
                        />
                        <img
                          className="object-cover h-full w-full"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="auto"
                          src="https://cdn.sanity.io/images/2hv88549/production/d3c8107d95ae7f6604adf275457656c68d117b2a-2515x1677.jpg?auto=format"
                        />
                      </picture>
                    </div>
                    <div className="z-20 col-span-full row-span-full">
                      <div
                        className="relative w-full overflow-hidden select-none border border-border rounded"
                        style={{
                          height: 'min(780px, 70vh)',
                          minHeight: '650px',
                        }}
                      >
                        <div className="absolute top-0 right-0 bottom-0 left-0 z-10 h-full w-full max-[767px]:pointer-events-none max-[767px]:opacity-0 transition-opacity duration-150">
                          <div className="sr-only" aria-live="polite">
                            This element contains an interactive demo for sighted users showing
                            Tensr&apos;s statistical analysis platform with data visualization and
                            analysis tools.
                          </div>
                          {/* Demo window placeholder */}
                          <div className="absolute inset-0 p-4">
                            <MarketingProductPreview />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Feature */}
        <section
          className="py-12 px-4 md:px-8 bg-background text-font"
          data-sanity="id=homepage;type=page;path=pageBuilder:d4245b5f3e89;base=http%3A%2F%2Flocalhost%3A3333"
        >
          <div className="container mx-auto mb-16">
            <div className="grid grid-rows-[auto_1fr]">
              <Link
                className="group bg-card border border-border rounded-lg p-6 col-span-full row-span-full gap-y-0 max-lg:grid-rows-subgrid"
                href="/features#tab"
              >
                <div className="col-span-full row-start-1 row-end-2 grid lg:row-start-1 lg:row-end-3 lg:items-center lg:col-start-17 lg:col-end-25 lg:pr-g0.25 lg:pl-g3">
                  <div className="max-w-2xl w-full lg:justify-self-end">
                    <div className="text-base flex-1">
                      <h3 className="text-base md:text-lg font-medium text-pretty">
                        Data preparation and cleaning tools
                      </h3>
                      <div className="text-base md:text-lg text-muted-foreground text-pretty">
                        <p>
                          Clean, transform, and prepare your data with intuitive tools designed for
                          researchers and data scientists.
                        </p>
                      </div>
                    </div>
                    <div className="mt-v8/12">
                      <span className="text-primary group-hover:underline inline-flex items-center gap-1">
                        Learn about our features →
                      </span>
                    </div>
                  </div>
                </div>
                <div className="max-lg:mt-g1.75 col-span-full row-start-2 row-end-3 grid cursor-default items-end lg:row-start-1 lg:row-end-3 lg:items-center lg:col-start-1 lg:col-end-17"></div>
              </Link>
              <div className="p-7 col-span-full row-span-full gap-y-0 max-lg:grid-rows-subgrid">
                <div className="col-span-full row-start-1 row-end-2 grid lg:row-start-1 lg:row-end-2 lg:items-center lg:col-start-17 lg:col-end-25 lg:pr-g0.25 lg:pl-g3"></div>
                <div className="max-lg:pt-v1 col-span-full row-start-2 row-end-3 grid cursor-default items-end lg:row-start-2 lg:row-end-3 lg:items-center lg:col-start-1 lg:col-end-17">
                  <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-lg">
                    <div className="relative z-1 col-span-full row-span-full overflow-hidden">
                      <picture className="absolute inset-0 scale-[1.1] transform brightness-90 dark:hidden">
                        <source
                          media="(min-width: 901px)"
                          srcSet="https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=3840 3840w"
                        />
                        <img
                          className="object-cover h-full w-full"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="auto"
                          src="https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format"
                        />
                      </picture>
                      <picture className="absolute inset-0 scale-[1.1] transform brightness-90 hidden dark:block">
                        <source
                          media="(min-width: 901px)"
                          srcSet="https://cdn.sanity.io/images/2hv88549/production/e7193be5129e61392f38b191266ecafa2410bb3d-2560x1440.png?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/e7193be5129e61392f38b191266ecafa2410bb3d-2560x1440.png?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/e7193be5129e61392f38b191266ecafa2410bb3d-2560x1440.png?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/e7193be5129e61392f38b191266ecafa2410bb3d-2560x1440.png?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/e7193be5129e61392f38b191266ecafa2410bb3d-2560x1440.png?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/e7193be5129e61392f38b191266ecafa2410bb3d-2560x1440.png?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/e7193be5129e61392f38b191266ecafa2410bb3d-2560x1440.png?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/e7193be5129e61392f38b191266ecafa2410bb3d-2560x1440.png?auto=format&w=3840 3840w"
                        />
                        <img
                          className="object-cover h-full w-full"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="auto"
                          src="https://cdn.sanity.io/images/2hv88549/production/e7193be5129e61392f38b191266ecafa2410bb3d-2560x1440.png?auto=format"
                        />
                      </picture>
                    </div>
                    <div className="z-20 col-span-full row-span-full">
                      <div
                        className="relative w-full overflow-hidden select-none border border-border rounded"
                        style={{
                          height: 'min(780px, 70vh)',
                          minHeight: '650px',
                        }}
                      >
                        <div className="absolute top-0 right-0 bottom-0 left-0 z-10 h-full w-full max-[767px]:pointer-events-none max-[767px]:opacity-0 transition-opacity duration-150">
                          <div className="sr-only" aria-live="polite">
                            This element contains an interactive demo for sighted users showing
                            Tensr&apos;s statistical analysis platform with data visualization and
                            analysis tools.
                          </div>
                          {/* Demo window placeholder */}
                          <div className="absolute inset-0 p-4">
                            <MarketingProductPreview />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ecosystem Feature */}
        <section
          className="py-12 px-4 md:px-8 bg-background text-font"
          data-sanity="id=homepage;type=page;path=pageBuilder:c552548f3a9e;base=http%3A%2F%2Flocalhost%3A3333"
        >
          <div className="container mx-auto">
            <div className="grid grid-rows-[auto_1fr]">
              <Link
                className="group bg-card border border-border rounded-lg p-6 col-span-full row-span-full gap-y-0 max-lg:grid-rows-subgrid"
                href="/features#ecosystem"
              >
                <div className="col-span-full row-start-1 row-end-2 grid lg:row-start-1 lg:row-end-3 lg:items-center lg:col-start-1 lg:col-end-9 lg:pl-g0.25 lg:pr-g3">
                  <div className="max-w-2xl w-full lg:justify-self-start">
                    <div className="text-base flex-1">
                      <h3 className="text-base md:text-lg font-medium text-pretty">
                        Plugin architecture and extensibility
                      </h3>
                      <div className="text-base md:text-lg text-muted-foreground text-pretty">
                        <p>
                          Extend Tensr with custom plugins and integrations. Build your own tools
                          with our SDK or use community plugins.
                        </p>
                      </div>
                    </div>
                    <div className="mt-v8/12">
                      <span className="text-primary group-hover:underline inline-flex items-center gap-1">
                        Learn about our features →
                      </span>
                    </div>
                  </div>
                </div>
                <div className="max-lg:mt-g1.75 col-span-full row-start-2 row-end-3 grid cursor-default items-end lg:row-start-1 lg:row-end-3 lg:items-center lg:col-start-9 lg:col-end-25"></div>
              </Link>
              <div className="p-7 col-span-full row-span-full gap-y-0 max-lg:grid-rows-subgrid">
                <div className="col-span-full row-start-1 row-end-2 grid lg:row-start-1 lg:row-end-2 lg:items-center lg:col-start-1 lg:col-end-9 lg:pl-g0.25 lg:pr-g3"></div>
                <div className="max-lg:pt-v1 col-span-full row-start-2 row-end-3 grid cursor-default items-end lg:row-start-2 lg:row-end-3 lg:items-center lg:col-start-9 lg:col-end-25">
                  <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-lg">
                    <div className="relative z-1 col-span-full row-span-full overflow-hidden">
                      <picture className="absolute inset-0 scale-[1.1] transform brightness-90">
                        <source
                          media="(min-width: 901px)"
                          srcSet="https://cdn.sanity.io/images/2hv88549/production/85923e7fafe00c9c0d1f749ecd21e0c245653158-2798x1354.jpg?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/85923e7fafe00c9c0d1f749ecd21e0c245653158-2798x1354.jpg?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/85923e7fafe00c9c0d1f749ecd21e0c245653158-2798x1354.jpg?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/85923e7fafe00c9c0d1f749ecd21e0c245653158-2798x1354.jpg?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/85923e7fafe00c9c0d1f749ecd21e0c245653158-2798x1354.jpg?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/85923e7fafe00c9c0d1f749ecd21e0c245653158-2798x1354.jpg?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/85923e7fafe00c9c0d1f749ecd21e0c245653158-2798x1354.jpg?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/85923e7fafe00c9c0d1f749ecd21e0c245653158-2798x1354.jpg?auto=format&w=3840 3840w"
                        />
                        <img
                          className="object-cover h-full w-full"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="auto"
                          src="https://cdn.sanity.io/images/2hv88549/production/85923e7fafe00c9c0d1f749ecd21e0c245653158-2798x1354.jpg?auto=format"
                        />
                      </picture>
                    </div>
                    <div className="z-20 col-span-full row-span-full">
                      <div
                        className="relative w-full overflow-hidden select-none border border-border rounded"
                        style={{
                          height: 'min(780px, 70vh)',
                          minHeight: '650px',
                        }}
                      >
                        <div className="absolute top-0 right-0 bottom-0 left-0 z-10 h-full w-full max-[767px]:pointer-events-none max-[767px]:opacity-0 transition-opacity duration-150">
                          <div className="sr-only" aria-live="polite">
                            This element contains an interactive demo for sighted users showing
                            Tensr&apos;s plugin architecture and extensibility features.
                          </div>
                          {/* Demo window placeholder */}
                          <div className="absolute inset-0 p-4">
                            <MarketingProductPreview />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>

      {/* Testimonials Section */}
      <section
        className="py-12 px-4 md:px-8 bg-background text-font"
        data-sanity="id=homepage;type=page;path=pageBuilder:529152ecb4a1;base=http%3A%2F%2Flocalhost%3A3333"
      >
        <div className="container mx-auto">
          <div className="text-center mx-auto mb-10 max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-normal text-balance mx-auto">
              The modern way to analyze data.
            </h2>
          </div>
          <div className="gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Testimonial 1 - Diana Hu */}
            <div className="bg-card border border-border rounded-lg p-6 md:aspect-[2/1] lg:aspect-[8/5]">
              <figure className="flex flex-col col-span-full row-span-full">
                <blockquote className="flex-1">
                  <p className="text-base whitespace-pre-wrap">
                    It was night and day from one batch to another, adoption went from single digits
                    to over 80%. It just spread like wildfire, all the best builders were using
                    Cursor.
                  </p>
                </blockquote>
                <div className="mt-4 flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded overflow-hidden">
                    <picture className="block h-full w-full">
                      <source srcSet="https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=16 16w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=32 32w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=48 48w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=64 64w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=96 96w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=128 128w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=256 256w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=384 384w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format&w=3840 3840w" />
                      <img
                        className="object-cover h-full w-full"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width="84"
                        height="84"
                        fetchPriority="auto"
                        src="https://cdn.sanity.io/images/2hv88549/production/fcdcbb0e010754abe55eaa640457c425b295d166-84x84.png?auto=format"
                      />
                    </picture>
                  </div>
                  <figcaption>
                    <div className="text-sm">
                      Diana Hu{' '}
                      <span className="text-sm text-muted-foreground block">
                        General Partner, Y Combinator
                      </span>
                    </div>
                  </figcaption>
                </div>
              </figure>
            </div>

            {/* Testimonial 2 - shadcn */}
            <div className="bg-card border border-border rounded-lg p-6 md:aspect-[2/1] lg:aspect-[8/5]">
              <figure className="flex flex-col col-span-full row-span-full">
                <blockquote className="flex-1">
                  <p className="text-base whitespace-pre-wrap">
                    The most useful AI tool that I currently pay for, hands down, is Cursor.
                    It&apos;s fast, autocompletes when and where you need it to, handles brackets
                    properly, sensible keyboard shortcuts, bring-your-own-model... everything is
                    well put together.
                  </p>
                </blockquote>
                <div className="mt-4 flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded overflow-hidden">
                    <picture className="block h-full w-full">
                      <source srcSet="https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=16 16w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=32 32w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=48 48w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=64 64w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=96 96w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=128 128w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=256 256w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=384 384w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format&w=3840 3840w" />
                      <img
                        className="object-cover h-full w-full"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width="84"
                        height="84"
                        fetchPriority="auto"
                        src="https://cdn.sanity.io/images/2hv88549/production/5b975491b9ace97040eca409dfa9819cbb80ab76-84x84.png?auto=format"
                      />
                    </picture>
                  </div>
                  <figcaption>
                    <div className="type-sm">
                      shadcn{' '}
                      <span className="text-sm text-muted-foreground block">
                        Creator of shadcn/ui
                      </span>
                    </div>
                  </figcaption>
                </div>
              </figure>
            </div>

            {/* Testimonial 3 - Andrej Karpathy */}
            <div className="bg-card border border-border rounded-lg p-6 md:aspect-[2/1] lg:aspect-[8/5]">
              <figure className="flex flex-col col-span-full row-span-full">
                <blockquote className="flex-1">
                  <p className="text-base whitespace-pre-wrap">
                    The best LLM applications have an autonomy slider: you control how much
                    independence to give the AI. In Cursor, you can do Tab completion, Cmd+K for
                    targeted edits, or you can let it rip with the full autonomy agentic version.
                  </p>
                </blockquote>
                <div className="mt-4 flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded overflow-hidden">
                    <picture className="block h-full w-full">
                      <source srcSet="https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=16 16w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=32 32w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=48 48w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=64 64w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=96 96w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=128 128w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=256 256w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=384 384w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format&w=3840 3840w" />
                      <img
                        className="object-cover h-full w-full"
                        alt="Andrej Karpathy, CEO, Eureka Labs"
                        loading="lazy"
                        decoding="async"
                        width="84"
                        height="84"
                        fetchPriority="auto"
                        src="https://cdn.sanity.io/images/2hv88549/production/4427316a06b0a5764ddf36b018ed04a7ead481f2-84x84.png?auto=format"
                      />
                    </picture>
                  </div>
                  <figcaption>
                    <div className="type-sm">
                      Andrej Karpathy{' '}
                      <span className="text-sm text-muted-foreground block">CEO, Eureka Labs</span>
                    </div>
                  </figcaption>
                </div>
              </figure>
            </div>

            {/* Testimonial 4 - Patrick Collison */}
            <div className="bg-card border border-border rounded-lg p-6 md:aspect-[2/1] lg:aspect-[8/5]">
              <figure className="flex flex-col col-span-full row-span-full">
                <blockquote className="flex-1">
                  <p className="text-base whitespace-pre-wrap">
                    Cursor quickly grew from hundreds to thousands of extremely enthusiastic Stripe
                    employees. We spend more on R&amp;D and software creation than any other
                    undertaking, and there&apos;s significant economic outcomes when making that
                    process more efficient and productive.
                  </p>
                </blockquote>
                <div className="mt-4 flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded overflow-hidden">
                    <picture className="block h-full w-full">
                      <source srcSet="https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=16 16w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=32 32w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=48 48w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=64 64w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=96 96w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=128 128w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=256 256w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=384 384w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format&w=3840 3840w" />
                      <img
                        className="object-cover h-full w-full"
                        alt="Patrick Collison, Co‑founder &amp; CEO, Stripe"
                        loading="lazy"
                        decoding="async"
                        width="93"
                        height="93"
                        fetchPriority="auto"
                        src="https://cdn.sanity.io/images/2hv88549/production/a8dcd16f0d888eed3f8e33299c2451eb2ae4a493-93x93.png?auto=format"
                      />
                    </picture>
                  </div>
                  <figcaption>
                    <div className="type-sm">
                      Patrick Collison{' '}
                      <span className="text-sm text-muted-foreground block">
                        Co‑Founder &amp; CEO, Stripe
                      </span>
                    </div>
                  </figcaption>
                </div>
              </figure>
            </div>

            {/* Testimonial 5 - ThePrimeagen */}
            <div className="bg-card border border-border rounded-lg p-6 md:aspect-[2/1] lg:aspect-[8/5]">
              <figure className="flex flex-col col-span-full row-span-full">
                <blockquote className="flex-1">
                  <p className="text-base whitespace-pre-wrap">
                    It&apos;s official.
                    {'\n\n'}I hate vibe coding.
                    {'\n\n'}I love Cursor tab coding.
                    {'\n\n'}
                    It&apos;s wild.
                  </p>
                </blockquote>
                <div className="mt-4 flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded overflow-hidden">
                    <picture className="block h-full w-full">
                      <source srcSet="https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=16 16w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=32 32w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=48 48w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=64 64w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=96 96w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=128 128w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=256 256w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=384 384w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format&w=3840 3840w" />
                      <img
                        className="object-cover h-full w-full"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width="84"
                        height="84"
                        fetchPriority="auto"
                        src="https://cdn.sanity.io/images/2hv88549/production/6e35a34559ef40d60cd05033ffcf062ac9f7caeb-84x84.png?auto=format"
                      />
                    </picture>
                  </div>
                  <figcaption>
                    <div className="type-sm">
                      ThePrimeagen{' '}
                      <span className="text-sm text-muted-foreground block">@ThePrimeagen</span>
                    </div>
                  </figcaption>
                </div>
              </figure>
            </div>

            {/* Testimonial 6 - Greg Brockman */}
            <div className="bg-card border border-border rounded-lg p-6 md:aspect-[2/1] lg:aspect-[8/5]">
              <figure className="flex flex-col col-span-full row-span-full">
                <blockquote className="flex-1">
                  <p className="text-base whitespace-pre-wrap">
                    It&apos;s definitely becoming more fun to be a programmer. It&apos;s less about
                    digging through pages and more about what you want to happen. We are at the 1%
                    of what&apos;s possible, and it&apos;s in interactive experiences like Cursor
                    where models like GPT-5 shine brightest.
                  </p>
                </blockquote>
                <div className="mt-4 flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded overflow-hidden">
                    <picture className="block h-full w-full">
                      <source srcSet="https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=16 16w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=32 32w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=48 48w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=64 64w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=96 96w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=128 128w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=256 256w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=384 384w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format&w=3840 3840w" />
                      <img
                        className="object-cover h-full w-full"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width="400"
                        height="400"
                        fetchPriority="auto"
                        src="https://cdn.sanity.io/images/2hv88549/production/924c80c6c0c69a8fc6f3f9f4fd8a1a5e75bf74c7-400x400.jpg?auto=format"
                      />
                    </picture>
                  </div>
                  <figcaption>
                    <div className="type-sm">
                      Greg Brockman{' '}
                      <span className="text-sm text-muted-foreground block">President, OpenAI</span>
                    </div>
                  </figcaption>
                </div>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* Stay on the Frontier Section */}
      <section
        className="py-12 px-4 md:px-8 bg-background text-font"
        data-sanity="id=homepage;type=page;path=pageBuilder:b18a7487bc79;base=http%3A%2F%2Flocalhost%3A3333"
      >
        <div className="container mx-auto my-8">
          <div className="text-left mb-4 max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-normal text-balance">
              Powerful analysis capabilities
            </h2>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-stretch">
            {/* Advanced Statistical Methods */}
            <div className="undefined h-full">
              <Link
                className="bg-card border border-border rounded-lg p-6 flex h-full flex-1 flex-col"
                href="/features"
              >
                <div className="text-base flex max-w-2xl flex-1 flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Advanced statistical methods</h3>
                    <div className="text-muted-foreground text-pretty">
                      <p>
                        From descriptive statistics to Structural Equation Modeling, factor
                        analysis, and machine learning.
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-primary hover:underline inline-flex items-center gap-1">
                      Explore features →
                    </span>
                  </div>
                </div>
                <figure className="pt-7">
                  <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-lg">
                    <div className="relative z-1 col-span-full row-span-full overflow-hidden">
                      <picture className="absolute inset-0 scale-[1.1] transform brightness-90 dark:hidden">
                        <source
                          media="(min-width: 901px)"
                          srcSet="https://cdn.sanity.io/images/2hv88549/production/e6375f83012e4a76ff15411ce87937362c411153-2560x1440.png?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/e6375f83012e4a76ff15411ce87937362c411153-2560x1440.png?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/e6375f83012e4a76ff15411ce87937362c411153-2560x1440.png?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/e6375f83012e4a76ff15411ce87937362c411153-2560x1440.png?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/e6375f83012e4a76ff15411ce87937362c411153-2560x1440.png?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/e6375f83012e4a76ff15411ce87937362c411153-2560x1440.png?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/e6375f83012e4a76ff15411ce87937362c411153-2560x1440.png?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/e6375f83012e4a76ff15411ce87937362c411153-2560x1440.png?auto=format&w=3840 3840w"
                        />
                        <img
                          className="object-cover h-full w-full"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="auto"
                          src="https://cdn.sanity.io/images/2hv88549/production/e6375f83012e4a76ff15411ce87937362c411153-2560x1440.png?auto=format"
                        />
                      </picture>
                      <picture className="absolute inset-0 scale-[1.1] transform brightness-90 hidden dark:block">
                        <source
                          media="(min-width: 901px)"
                          srcSet="https://cdn.sanity.io/images/2hv88549/production/0f82efbbc1a26deeca193a2deb5cdd3efbabac59-2560x1440.png?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/0f82efbbc1a26deeca193a2deb5cdd3efbabac59-2560x1440.png?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/0f82efbbc1a26deeca193a2deb5cdd3efbabac59-2560x1440.png?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/0f82efbbc1a26deeca193a2deb5cdd3efbabac59-2560x1440.png?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/0f82efbbc1a26deeca193a2deb5cdd3efbabac59-2560x1440.png?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/0f82efbbc1a26deeca193a2deb5cdd3efbabac59-2560x1440.png?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/0f82efbbc1a26deeca193a2deb5cdd3efbabac59-2560x1440.png?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/0f82efbbc1a26deeca193a2deb5cdd3efbabac59-2560x1440.png?auto=format&w=3840 3840w"
                        />
                        <img
                          className="object-cover h-full w-full"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="auto"
                          src="https://cdn.sanity.io/images/2hv88549/production/0f82efbbc1a26deeca193a2deb5cdd3efbabac59-2560x1440.png?auto=format"
                        />
                      </picture>
                    </div>
                    <div className="z-20 col-span-full row-span-full">
                      <div
                        className="aspect-4/3-box md:aspect-1/1-box"
                        style={{
                          position: 'relative',
                          width: '100%',
                          backgroundColor: 'transparent',
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div
                            className="bg-theme-card-hex text-theme-text min-w-[180px] overflow-hidden rounded-md"
                            role="menu"
                            aria-label="Model menu"
                            style={{
                              boxShadow: 'var(--shadow-outline-theme)',
                              minWidth: '180px',
                              maxWidth: 'min(83.3333%, 320px)',
                              width: '100%',
                            }}
                          >
                            <div className="p-1">
                              <button
                                type="button"
                                className="text-theme-text-sec px-g0.75 type-product-lg py-v3/12 flex w-full items-center rounded-xs text-left"
                                role="menuitem"
                              >
                                <span className="flex flex-1 items-baseline gap-2">
                                  <span className="text-theme-text">Auto</span>
                                  <span className="text-theme-text-tertiary type-product-sm">
                                    Suggested
                                  </span>
                                </span>
                              </button>
                              <button
                                type="button"
                                className="text-theme-text-sec px-g0.75 type-product-lg py-v3/12 flex w-full items-center rounded-xs text-left"
                                role="menuitem"
                              >
                                <span className="flex flex-1 items-baseline gap-2">
                                  <span className="text-theme-text">Composer 1</span>
                                </span>
                              </button>
                              <button
                                type="button"
                                className="text-theme-text-sec px-g0.75 type-product-lg py-v3/12 flex w-full items-center rounded-xs text-left"
                                role="menuitem"
                              >
                                <span className="flex flex-1 items-baseline gap-2">
                                  <span className="text-theme-text">GPT-5</span>
                                  <span className="text-theme-text-tertiary type-product-sm">
                                    High Fast
                                  </span>
                                </span>
                              </button>
                              <button
                                type="button"
                                className="text-theme-text-sec px-g0.75 type-product-lg py-v3/12 flex w-full items-center rounded-xs text-leftbg-theme-card-02-hex"
                                role="menuitem"
                              >
                                <span className="flex flex-1 items-baseline gap-2">
                                  <span className="text-theme-text">Claude Sonnet 4.5</span>
                                </span>
                                <span className="font-feature-case ml-2">✓</span>
                              </button>
                              <button
                                type="button"
                                className="text-theme-text-sec px-g0.75 type-product-lg py-v3/12 flex w-full items-center rounded-xs text-left"
                                role="menuitem"
                              >
                                <span className="flex flex-1 items-baseline gap-2">
                                  <span className="text-theme-text">Claude Opus 4.5</span>
                                </span>
                              </button>
                              <button
                                type="button"
                                className="text-theme-text-sec px-g0.75 type-product-lg py-v3/12 flex w-full items-center rounded-xs text-left"
                                role="menuitem"
                              >
                                <span className="flex flex-1 items-baseline gap-2">
                                  <span className="text-theme-text">Gemini 3 Pro</span>
                                </span>
                              </button>
                              <button
                                type="button"
                                className="text-theme-text-sec px-g0.75 type-product-lg py-v3/12 flex w-full items-center rounded-xs text-left"
                                role="menuitem"
                              >
                                <span className="flex flex-1 items-baseline gap-2">
                                  <span className="text-theme-text">Grok Code</span>
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </figure>
              </Link>
            </div>

            {/* Interactive Notebooks */}
            <div className="undefined h-full">
              <Link
                className="bg-card border border-border rounded-lg p-6 flex h-full flex-1 flex-col"
                href="/features"
              >
                <div className="text-base flex max-w-2xl flex-1 flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Interactive notebooks</h3>
                    <div className="text-muted-foreground text-pretty">
                      <p>
                        Create interactive documents with code, visuals, and text. Perfect for
                        research and collaboration.
                      </p>
                    </div>
                  </div>
                  <div className="mt-v8/12">
                    <span className="text-primary hover:underline inline-flex items-center gap-1">
                      Learn about notebooks →
                    </span>
                  </div>
                </div>
                <figure className="pt-7">
                  <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-lg">
                    <div className="relative z-1 col-span-full row-span-full overflow-hidden">
                      <picture className="absolute inset-0 media-light">
                        <source
                          media="(min-width: 901px)"
                          srcSet="https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format&w=3840 3840w"
                        />
                        <img
                          className="object-cover h-full w-full"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="auto"
                          src="https://cdn.sanity.io/images/2hv88549/production/fd9b3b4cd7d670f9f7d89ef54a9d83eedc7eb8cc-2560x1440.png?auto=format"
                        />
                      </picture>
                      <picture className="absolute inset-0 media-dark">
                        <source
                          media="(min-width: 901px)"
                          srcSet="https://cdn.sanity.io/images/2hv88549/production/3cb319c263fd5a76115b6196b916ce8767daec13-2560x1440.png?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/3cb319c263fd5a76115b6196b916ce8767daec13-2560x1440.png?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/3cb319c263fd5a76115b6196b916ce8767daec13-2560x1440.png?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/3cb319c263fd5a76115b6196b916ce8767daec13-2560x1440.png?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/3cb319c263fd5a76115b6196b916ce8767daec13-2560x1440.png?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/3cb319c263fd5a76115b6196b916ce8767daec13-2560x1440.png?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/3cb319c263fd5a76115b6196b916ce8767daec13-2560x1440.png?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/3cb319c263fd5a76115b6196b916ce8767daec13-2560x1440.png?auto=format&w=3840 3840w"
                        />
                        <img
                          className="object-cover h-full w-full"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="auto"
                          src="https://cdn.sanity.io/images/2hv88549/production/3cb319c263fd5a76115b6196b916ce8767daec13-2560x1440.png?auto=format"
                        />
                      </picture>
                    </div>
                    <div className="z-20 col-span-full row-span-full">
                      <div
                        className="aspect-4/3-box md:aspect-1/1-box"
                        style={{
                          position: 'relative',
                          width: '100%',
                          backgroundColor: 'transparent',
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div
                            role="region"
                            aria-label="Tool calls"
                            style={{
                              minWidth: '180px',
                              maxWidth: 'min(83.3333%, 360px)',
                              width: '100%',
                            }}
                          >
                            <div>
                              <div
                                className="space-y-v9/12"
                                style={{
                                  transform: 'none',
                                  transformOrigin: '50% 50% 0px',
                                }}
                              >
                                <div
                                  className="border-theme-border-02 bg-theme-card-04-hex text-theme-text type-product-lg px-g1 py-g0.75 w-full rounded-md border"
                                  style={{
                                    opacity: 1,
                                    transform: 'none',
                                    transformOrigin: '50% 50% 0px',
                                  }}
                                >
                                  Where are these menu label colors defined?
                                </div>
                                <ul
                                  className="space-y-v6/12 pl-g0.5"
                                  style={{
                                    transform: 'none',
                                    transformOrigin: '50% 50% 0px',
                                  }}
                                >
                                  <li
                                    className="type-product-lg text-theme-text-sec leading-snug"
                                    style={{
                                      opacity: 1,
                                      transform: 'none',
                                      transformOrigin: '50% 50% 0px',
                                    }}
                                  >
                                    <div className="text-theme-text-sec flex items-baseline gap-1 overflow-hidden">
                                      <span className="text-theme-text-sec flex-shrink-0">
                                        Grepped
                                      </span>
                                      <span className="text-theme-text-sec min-w-0 truncate opacity-60">
                                        {' '}
                                        Choose a model
                                      </span>
                                    </div>
                                  </li>
                                  <li
                                    className="type-product-lg text-theme-text-sec leading-snug"
                                    style={{
                                      opacity: 1,
                                      transform: 'none',
                                      transformOrigin: '50% 50% 0px',
                                    }}
                                  >
                                    <div className="text-theme-text-sec flex items-baseline gap-1 overflow-hidden">
                                      <span className="text-theme-text-sec flex-shrink-0">
                                        Searched
                                      </span>
                                      <span className="text-theme-text-sec min-w-0 truncate opacity-60">
                                        {' '}
                                        Where is the model picker UI implemented?
                                      </span>
                                    </div>
                                  </li>
                                  <li
                                    className="type-product-lg text-theme-text-sec leading-snug"
                                    style={{
                                      opacity: 1,
                                      transform: 'none',
                                      transformOrigin: '50% 50% 0px',
                                    }}
                                  >
                                    <div className="text-theme-text-sec flex items-baseline gap-1 overflow-hidden">
                                      <span className="text-theme-text-sec flex-shrink-0">
                                        Searched
                                      </span>
                                      <span className="text-theme-text-sec min-w-0 truncate opacity-60">
                                        {' '}
                                        How are model labels colored in the UI?
                                      </span>
                                    </div>
                                  </li>
                                  <li
                                    className="type-product-lg text-theme-text-sec leading-snug"
                                    style={{
                                      opacity: 1,
                                      transform: 'none',
                                      transformOrigin: '50% 50% 0px',
                                    }}
                                  >
                                    <div className="text-theme-text-sec flex items-baseline gap-1 overflow-hidden">
                                      <span className="text-theme-text-sec flex-shrink-0">
                                        Read
                                      </span>
                                      <span className="text-theme-text-sec min-w-0 truncate opacity-60">
                                        {' '}
                                        ContextMenu.tsx
                                      </span>
                                    </div>
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </figure>
              </Link>
            </div>

            {/* Enterprise Solutions */}
            <div className="undefined h-full">
              <Link
                className="bg-card border border-border rounded-lg p-6 flex h-full flex-1 flex-col"
                href="/enterprise"
              >
                <div className="text-base flex max-w-2xl flex-1 flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Enterprise solutions</h3>
                    <div className="text-muted-foreground text-pretty">
                      <p>
                        Scalable statistical analysis platform designed for teams and organizations
                        with advanced collaboration features.
                      </p>
                    </div>
                  </div>
                  <div className="mt-v8/12">
                    <span className="text-primary hover:underline inline-flex items-center gap-1">
                      Explore enterprise →
                    </span>
                  </div>
                </div>
                <figure className="pt-7">
                  <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-lg">
                    <div className="z-20 col-span-full row-span-full grid">
                      <picture className="block h-full w-full">
                        <source
                          media="(min-width: 901px)"
                          srcSet="https://cdn.sanity.io/images/2hv88549/production/ca9266c50fa4f586d9f26ad68ec08aaa847b2f82-2160x2160.jpg?auto=format&w=384 384w, https://cdn.sanity.io/images/2hv88549/production/ca9266c50fa4f586d9f26ad68ec08aaa847b2f82-2160x2160.jpg?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/ca9266c50fa4f586d9f26ad68ec08aaa847b2f82-2160x2160.jpg?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/ca9266c50fa4f586d9f26ad68ec08aaa847b2f82-2160x2160.jpg?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/ca9266c50fa4f586d9f26ad68ec08aaa847b2f82-2160x2160.jpg?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/ca9266c50fa4f586d9f26ad68ec08aaa847b2f82-2160x2160.jpg?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/ca9266c50fa4f586d9f26ad68ec08aaa847b2f82-2160x2160.jpg?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/ca9266c50fa4f586d9f26ad68ec08aaa847b2f82-2160x2160.jpg?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/ca9266c50fa4f586d9f26ad68ec08aaa847b2f82-2160x2160.jpg?auto=format&w=3840 3840w"
                        />
                        <source
                          media="(max-width: 900px)"
                          srcSet="https://cdn.sanity.io/images/2hv88549/production/6f4f4348d1d7da2ab88b38f0705f30bdfb0d247c-2880x2160.jpg?auto=format&w=384 384w, https://cdn.sanity.io/images/2hv88549/production/6f4f4348d1d7da2ab88b38f0705f30bdfb0d247c-2880x2160.jpg?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/6f4f4348d1d7da2ab88b38f0705f30bdfb0d247c-2880x2160.jpg?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/6f4f4348d1d7da2ab88b38f0705f30bdfb0d247c-2880x2160.jpg?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/6f4f4348d1d7da2ab88b38f0705f30bdfb0d247c-2880x2160.jpg?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/6f4f4348d1d7da2ab88b38f0705f30bdfb0d247c-2880x2160.jpg?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/6f4f4348d1d7da2ab88b38f0705f30bdfb0d247c-2880x2160.jpg?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/6f4f4348d1d7da2ab88b38f0705f30bdfb0d247c-2880x2160.jpg?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/6f4f4348d1d7da2ab88b38f0705f30bdfb0d247c-2880x2160.jpg?auto=format&w=3840 3840w"
                        />
                        <img
                          className="object-cover h-full w-full"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          width="2880"
                          height="2160"
                          fetchPriority="auto"
                          src="https://cdn.sanity.io/images/2hv88549/production/ca9266c50fa4f586d9f26ad68ec08aaa847b2f82-2160x2160.jpg?auto=format"
                        />
                      </picture>
                    </div>
                  </div>
                </figure>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Changelog Section */}
      <section
        className="py-12 px-4 md:px-8 bg-background text-font"
        data-sanity="id=homepage;type=page;path=pageBuilder:ae0d591090d2;base=http%3A%2F%2Flocalhost%3A3333"
      >
        <div className="container mx-auto">
          <h2 className="text-2xl md:text-3xl font-normal text-font mb-4">Latest updates</h2>
          <div className="gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <article
              data-sanity="id=c31ce8ea-4b7c-41a1-955c-68632aa2b691;type=changelog;path=title;base=%2F"
              className="flex flex-col"
            >
              <Link
                className="bg-card border border-border rounded-lg p-6 flex flex-col [&>*+*]:!mt-2 pb-8 flex-1 hover:bg-accent transition-colors"
                href="/changelog/2-1"
              >
                <div className="text-muted-foreground relative left-[-1px] flex items-center gap-4">
                  <span className="text-sm font-medium">2.1</span>
                  <time dateTime="2025-11-21T19:37:20.971Z" className="text-base">
                    Nov 21, 2025
                  </time>
                </div>
                <p className="text-base text-font">
                  Improved Plan Mode, AI Code Review in Editor, and Instant Grep
                </p>
              </Link>
            </article>
            <article
              data-sanity="id=99f9e3b9-f8f6-4719-974a-426511d70c82;type=changelog;path=title;base=%2F"
              className="flex flex-col"
            >
              <Link
                className="bg-card border border-border rounded-lg p-6 flex flex-col [&>*+*]:!mt-2 pb-8 flex-1 hover:bg-accent transition-colors"
                href="/changelog/2-0"
              >
                <div className="text-muted-foreground relative left-[-1px] flex items-center gap-4">
                  <span className="text-sm font-medium">2.0</span>
                  <time dateTime="2025-10-29T05:08:00.000Z" className="text-base">
                    Oct 29, 2025
                  </time>
                </div>
                <p className="text-base text-font">New Coding Model and Agent Interface</p>
              </Link>
            </article>
            <article
              data-sanity="id=853c90ae-0e66-4ce0-9766-6e406e98a083;type=changelog;path=title;base=%2F"
              className="flex flex-col"
            >
              <Link
                className="bg-card border border-border rounded-lg p-6 flex flex-col [&>*+*]:!mt-2 pb-8 flex-1 hover:bg-accent transition-colors"
                href="/changelog/1-7"
              >
                <div className="text-muted-foreground relative left-[-1px] flex items-center gap-4">
                  <span className="text-sm font-medium">1.7</span>
                  <time dateTime="2025-09-29T05:08:58.822Z" className="text-base">
                    Sep 29, 2025
                  </time>
                </div>
                <p className="text-base text-font">Browser Controls, Plan Mode, and Hooks</p>
              </Link>
            </article>
            <article
              data-sanity="id=8fc8a135-b0d9-4ad7-9db7-957768e793e6;type=changelog;path=title;base=%2F"
              className="flex flex-col"
            >
              <Link
                className="bg-card border border-border rounded-lg p-6 flex flex-col [&>*+*]:!mt-2 pb-8 flex-1 hover:bg-accent transition-colors"
                href="/changelog/1-6"
              >
                <div className="text-muted-foreground relative left-[-1px] flex items-center gap-4">
                  <span className="text-sm font-medium">1.6</span>
                  <time dateTime="2025-09-12T01:25:00.000Z" className="text-base">
                    Sep 12, 2025
                  </time>
                </div>
                <p className="text-base text-font">
                  Slash commands, summarization, and improved Agent terminal
                </p>
              </Link>
            </article>
          </div>
          <Link
            className="text-primary hover:underline mt-4 inline-flex items-center gap-1"
            href="/features"
          >
            See all features →
          </Link>
        </div>
      </section>

      {/* Careers Section */}
      <section
        className="py-12 px-4 md:px-8 bg-background text-font"
        data-sanity="id=homepage;type=page;path=pageBuilder:a860b02b8bfb4f687c23195f5799c0cb;base=http%3A%2F%2Flocalhost%3A3333"
      >
        <div className="container mx-auto">
          <div className="text-left mb-10 max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-normal text-balance mb-4">
              Built for researchers and data scientists.
            </h2>
            <div className="gap-x-4 flex items-center justify-start">
              <Link
                href="https://app.tensr.xyz"
                className="inline-flex items-center px-6 py-3 bg-[#26251e] text-white rounded-full hover:opacity-90 transition-colors text-sm font-medium"
              >
                Get started
                <span className="ml-2" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          </div>
          <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-lg">
            <div className="z-20 col-span-full row-span-full grid">
              <Link className="block h-full w-full" href="/careers">
                <picture className="block h-full w-full">
                  <source
                    media="(min-width: 901px)"
                    srcSet="https://cdn.sanity.io/images/2hv88549/production/884fea912ec17182c194fcf7b2917bf0c56e80eb-3840x2160.jpg?auto=format&w=384 384w, https://cdn.sanity.io/images/2hv88549/production/884fea912ec17182c194fcf7b2917bf0c56e80eb-3840x2160.jpg?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/884fea912ec17182c194fcf7b2917bf0c56e80eb-3840x2160.jpg?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/884fea912ec17182c194fcf7b2917bf0c56e80eb-3840x2160.jpg?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/884fea912ec17182c194fcf7b2917bf0c56e80eb-3840x2160.jpg?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/884fea912ec17182c194fcf7b2917bf0c56e80eb-3840x2160.jpg?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/884fea912ec17182c194fcf7b2917bf0c56e80eb-3840x2160.jpg?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/884fea912ec17182c194fcf7b2917bf0c56e80eb-3840x2160.jpg?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/884fea912ec17182c194fcf7b2917bf0c56e80eb-3840x2160.jpg?auto=format&w=3840 3840w"
                  />
                  <source
                    media="(max-width: 900px)"
                    srcSet="https://cdn.sanity.io/images/2hv88549/production/305fc0009a8e5be04a9c7ee25817e1304c777764-2880x2160.jpg?auto=format&w=384 384w, https://cdn.sanity.io/images/2hv88549/production/305fc0009a8e5be04a9c7ee25817e1304c777764-2880x2160.jpg?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/305fc0009a8e5be04a9c7ee25817e1304c777764-2880x2160.jpg?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/305fc0009a8e5be04a9c7ee25817e1304c777764-2880x2160.jpg?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/305fc0009a8e5be04a9c7ee25817e1304c777764-2880x2160.jpg?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/305fc0009a8e5be04a9c7ee25817e1304c777764-2880x2160.jpg?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/305fc0009a8e5be04a9c7ee25817e1304c777764-2880x2160.jpg?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/305fc0009a8e5be04a9c7ee25817e1304c777764-2880x2160.jpg?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/305fc0009a8e5be04a9c7ee25817e1304c777764-2880x2160.jpg?auto=format&w=3840 3840w"
                  />
                  <img
                    className="object-cover h-full w-full"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width="2880"
                    height="2160"
                    fetchPriority="auto"
                    src="https://cdn.sanity.io/images/2hv88549/production/884fea912ec17182c194fcf7b2917bf0c56e80eb-3840x2160.jpg?auto=format"
                  />
                </picture>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Highlights Section */}
      <section
        className="mt-12 py-20 px-4 md:px-8 bg-[var(--color-theme-card-hex)] text-[var(--color-theme-text)]"
        data-sanity="id=homepage;type=page;path=pageBuilder:2b649cd7633f;base=http%3A%2F%2Flocalhost%3A3333"
      >
        <div className="container mx-auto">
          <div className="grid grid-cols-[repeat(24,1fr)] gap-4">
            <div className="col-span-full md:col-start-1 md:col-end-7 lg:col-start-1 lg:col-end-9 xl:col-start-1 xl:col-end-7">
              <h2 className="text-base text-[var(--color-theme-text)] mb-4 sticky top-[var(--site-header-height)] lg:mb-0 font-normal">
                Recent highlights
              </h2>
            </div>
            <div className="col-span-full md:col-start-7 md:col-end-25 lg:col-start-9 lg:col-end-25 xl:col-start-7 xl:col-end-19">
              <article
                data-sanity="id=7aead0cb-76df-4585-bee6-1c3dfda359f6;type=post;path=title;base=%2F"
                className="flex flex-1 flex-col mb-4"
              >
                <Link
                  className="bg-[var(--color-theme-card-02-hex,#ebeae5)] rounded-sm p-6 flex-1 grid grid-cols-[1fr_auto] relative before:content-[''] before:pointer-events-none before:rounded-sm before:border before:border-[var(--color-theme-border-01)] before:z-30 before:absolute before:inset-0"
                  href="/blog/2-0"
                >
                  <div className="flex flex-col">
                    <div className="flex-1">
                      <p className="text-base text-[var(--color-theme-text)] text-pretty font-normal">
                        Introducing Cursor 2.0 and Composer
                      </p>
                      <p className="text-base text-[var(--color-theme-text-sec)] text-pretty">
                        A new interface and our first coding model, both purpose-built for working
                        with agents.
                      </p>
                    </div>
                    <div className="mt-4 text-[var(--color-theme-text-sec)] flex shrink-0 items-center">
                      <span className="capitalize">product&nbsp;·&nbsp;</span>
                      <time dateTime="2025-10-29T04:54:48.600Z" className="text-base">
                        Oct 29, 2025
                      </time>
                    </div>
                  </div>
                </Link>
              </article>
              <article
                data-sanity="id=28698eca-aada-4254-ba86-bb7a1b5f43b8;type=post;path=title;base=%2F"
                className="flex flex-1 flex-col mb-4"
              >
                <Link
                  className="bg-[var(--color-theme-card-02-hex,#ebeae5)] rounded-sm p-6 flex-1 grid grid-cols-[1fr_auto] relative before:content-[''] before:pointer-events-none before:rounded-sm before:border before:border-[var(--color-theme-border-01)] before:z-30 before:absolute before:inset-0"
                  href="/blog/tab-rl"
                >
                  <div className="flex flex-col">
                    <div className="flex-1">
                      <p className="text-base text-[var(--color-theme-text)] text-pretty font-normal">
                        Improving Cursor Tab with online RL
                      </p>
                      <p className="text-base text-[var(--color-theme-text-sec)] text-pretty">
                        Our new Tab model makes 21% fewer suggestions while having 28% higher accept
                        rate.
                      </p>
                    </div>
                    <div className="mt-4 text-[var(--color-theme-text-sec)] flex shrink-0 items-center">
                      <span className="capitalize">research&nbsp;·&nbsp;</span>
                      <time dateTime="2025-09-12T01:16:00.000Z" className="text-base">
                        Sep 12, 2025
                      </time>
                    </div>
                  </div>
                </Link>
              </article>
              <article
                data-sanity="id=9968b97c-6865-47af-970b-c644716aabe2;type=post;path=title;base=%2F"
                className="flex flex-1 flex-col"
              >
                <Link
                  className="bg-[var(--color-theme-card-02-hex,#ebeae5)] rounded-sm p-6 flex-1 grid grid-cols-[1fr_auto] relative before:content-[''] before:pointer-events-none before:rounded-sm before:border before:border-[var(--color-theme-border-01)] before:z-30 before:absolute before:inset-0"
                  href="/blog/kernels"
                >
                  <div className="flex flex-col">
                    <div className="flex-1">
                      <p className="text-base text-[var(--color-theme-text)] text-pretty font-normal">
                        1.5x faster MoE training with custom MXFP8 kernels
                      </p>
                      <p className="text-base text-[var(--color-theme-text-sec)] text-pretty">
                        Achieving a 3.5x MoE layer speedup with a complete rebuild for Blackwell
                        GPUs.
                      </p>
                    </div>
                    <div className="mt-4 text-[var(--color-theme-text-sec)] flex shrink-0 items-center">
                      <span className="capitalize">research&nbsp;·&nbsp;</span>
                      <time dateTime="2025-08-29T02:55:25.007Z" className="text-base">
                        Aug 29, 2025
                      </time>
                    </div>
                  </div>
                </Link>
              </article>
              <Link className="mt-4 inline-flex text-primary hover:underline" href="/blog">
                View more posts →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section
        className="py-32 md:py-48 px-4 md:px-8 bg-background text-font"
        data-sanity="id=homepage;type=page;path=pageBuilder:35bf44e785b0;base=http%3A%2F%2Flocalhost%3A3333"
      >
        <div className="container mx-auto">
          <div className="text-center mx-auto max-w-4xl">
            <h2 className="text-6xl sm:text-7xl font-normal text-balance mx-auto mb-4">
              Get started with Tensr.
            </h2>
            <div className="gap-x-4 flex items-center justify-center">
              <div className="space-y-1">
                <div className="hidden md:block">
                  <Link
                    href="https://app.tensr.xyz"
                    className="inline-flex items-center px-6 py-3 bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] rounded-full hover:opacity-90 transition-colors text-sm font-medium"
                  >
                    Get started
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
                <div className="block md:hidden">
                  <Link
                    href="https://app.tensr.xyz"
                    className="inline-flex items-center px-6 py-3 bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] rounded-full hover:opacity-90 transition-colors text-sm font-medium"
                  >
                    Get started
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomeTemplate;
