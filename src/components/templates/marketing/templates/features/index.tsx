'use client';

import { MarketingProductPreview } from '@/components/templates/marketing/marketing-product-preview';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const FeaturesTemplate = () => {
  return (
    <main id="main">
      {/* Hero Section */}
      <section className="py-12 px-4 md:px-8 bg-background text-font">
        <div className="container mx-auto">
          <div className="text-left mb-4 max-w-prose">
            <small className="text-base text-muted-foreground block mb-2">Features</small>
            <h1 className="text-4xl font-normal text-balance mb-4">
              Powerful tools for statistical analysis and data science.
            </h1>
            <div className="flex items-center justify-start gap-4 mt-6">
              <Link
                className="inline-flex items-center justify-center px-6 py-3 h-11 text-base font-medium rounded-full transition-all bg-[var(--color-button-primary-bg)] border border-[var(--color-button-primary-border)] text-[var(--color-button-primary-text)] hover:opacity-90"
                href="https://app.tensr.xyz"
              >
                Get started
                <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
              </Link>
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
                  alt="Tensr statistical analysis platform"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  src="https://cdn.sanity.io/images/2hv88549/production/cc24ca462279ca23250c6953612a9e3fd9838355-6360x4240.jpg?auto=format"
                />
              </picture>
            </div>
            <div className="z-20 col-span-full row-span-full">
              <div
                className="relative w-full overflow-hidden select-none border border-border rounded-sm"
                style={{
                  height: 'min(780px, 70vh)',
                  minHeight: '680px',
                }}
              >
                <div className="absolute top-0 right-0 bottom-0 left-0 z-10 h-full w-full max-[767px]:pointer-events-none max-[767px]:opacity-0 transition-opacity duration-150">
                  <div className="sr-only" aria-live="polite">
                    This element contains an interactive demo for sighted users showing Tensr&apos;s
                    statistical analysis platform with data visualization and analysis tools.
                  </div>
                  <div className="absolute inset-0 p-4">
                    <MarketingProductPreview />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistical Analysis Section */}
      <section className="w-full p-0 bg-background text-font" id="statistical-analysis">
        <div className="container mx-auto mb-16">
          <div className="grid grid-rows-[auto_1fr] gap-4">
            <Link
              className="relative bg-card border border-border rounded-sm p-6 sm:p-7 grid lg:grid-cols-2 gap-4 col-span-full row-span-full"
              href="#statistical-analysis"
            >
              <div className="lg:flex lg:items-center">
                <div className="max-w-prose w-full">
                  <div className="text-base flex-1">
                    <h2 className="text-base md:text-lg font-normal text-pretty">
                      Statistical Analysis Suite
                    </h2>
                    <div className="text-base md:text-lg text-muted-foreground text-pretty">
                      <p>
                        Complete suite of statistical methods from descriptive statistics to
                        advanced techniques like Structural Equation Modeling.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-primary hover:underline inline-flex items-center gap-1">
                      Learn more →
                    </span>
                  </div>
                </div>
              </div>
              <div className="hidden lg:block"></div>
            </Link>
            <div className="p-7 grid lg:grid-cols-2 gap-4 col-span-full row-span-full">
              <div className="hidden lg:block"></div>
              <div>
                <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-sm">
                  <div className="relative z-10 col-span-full row-span-full overflow-hidden">
                    <picture className="absolute inset-0 scale-[1.1] transform brightness-90">
                      <source
                        media="(min-width: 901px)"
                        srcSet="https://cdn.sanity.io/images/2hv88549/production/1ffde036387b7242c29496bd7b1009f2218bce43-3266x2324.jpg?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/1ffde036387b7242c29496bd7b1009f2218bce43-3266x2324.jpg?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/1ffde036387b7242c29496bd7b1009f2218bce43-3266x2324.jpg?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/1ffde036387b7242c29496bd7b1009f2218bce43-3266x2324.jpg?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/1ffde036387b7242c29496bd7b1009f2218bce43-3266x2324.jpg?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/1ffde036387b7242c29496bd7b1009f2218bce43-3266x2324.jpg?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/1ffde036387b7242c29496bd7b1009f2218bce43-3266x2324.jpg?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/1ffde036387b7242c29496bd7b1009f2218bce43-3266x2324.jpg?auto=format&w=3840 3840w"
                      />
                      <img
                        className="object-cover h-full w-full"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        fetchPriority="auto"
                        src="https://cdn.sanity.io/images/2hv88549/production/1ffde036387b7242c29496bd7b1009f2218bce43-3266x2324.jpg?auto=format"
                      />
                    </picture>
                  </div>
                  <div className="z-20 col-span-full row-span-full">
                    <div
                      className="relative w-full overflow-hidden select-none border border-border rounded-sm"
                      style={{
                        height: 'min(780px, 70vh)',
                        minHeight: '650px',
                      }}
                    >
                      <div className="absolute top-0 right-0 bottom-0 left-0 z-10 h-full w-full max-[767px]:pointer-events-none max-[767px]:opacity-0 transition-opacity duration-150">
                        <div className="sr-only" aria-live="polite">
                          This element contains an interactive demo for sighted users showing
                          Tensr&apos;s statistical analysis interface.
                        </div>
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

      {/* Data Transformation Feature */}
      <section className="w-full p-0 bg-background text-font" id="data-transformation">
        <div className="container mx-auto mb-16">
          <div className="grid grid-rows-[auto_1fr] gap-4">
            <Link
              className="relative bg-card border border-border rounded-sm p-6 sm:p-7 grid lg:grid-cols-2 gap-4 col-span-full row-span-full"
              href="#data-transformation"
            >
              <div className="hidden lg:block"></div>
              <div className="lg:flex lg:items-center lg:justify-end">
                <div className="max-w-prose w-full">
                  <div className="text-base flex-1">
                    <h2 className="text-base md:text-lg font-normal text-pretty">
                      Data Preparation & Cleaning
                    </h2>
                    <div className="text-base md:text-lg text-muted-foreground text-pretty">
                      <p>
                        Intuitive tools to clean, transform, and prepare your data for analysis with
                        advanced data transformation capabilities.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-primary hover:underline inline-flex items-center gap-1">
                      Learn more →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
            <div className="p-7 grid lg:grid-cols-2 gap-4 col-span-full row-span-full">
              <div>
                <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-sm">
                  <div className="relative z-10 col-span-full row-span-full overflow-hidden">
                    <picture className="absolute inset-0 scale-[1.1] transform brightness-90">
                      <source
                        media="(min-width: 901px)"
                        srcSet="https://cdn.sanity.io/images/2hv88549/production/6a23c94721e22f5c31f2ef72ccd7cdf9fecd9e12-1995x1330.jpg?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/6a23c94721e22f5c31f2ef72ccd7cdf9fecd9e12-1995x1330.jpg?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/6a23c94721e22f5c31f2ef72ccd7cdf9fecd9e12-1995x1330.jpg?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/6a23c94721e22f5c31f2ef72ccd7cdf9fecd9e12-1995x1330.jpg?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/6a23c94721e22f5c31f2ef72ccd7cdf9fecd9e12-1995x1330.jpg?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/6a23c94721e22f5c31f2ef72ccd7cdf9fecd9e12-1995x1330.jpg?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/6a23c94721e22f5c31f2ef72ccd7cdf9fecd9e12-1995x1330.jpg?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/6a23c94721e22f5c31f2ef72ccd7cdf9fecd9e12-1995x1330.jpg?auto=format&w=3840 3840w"
                      />
                      <img
                        className="object-cover h-full w-full"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        fetchPriority="auto"
                        src="https://cdn.sanity.io/images/2hv88549/production/6a23c94721e22f5c31f2ef72ccd7cdf9fecd9e12-1995x1330.jpg?auto=format"
                      />
                    </picture>
                  </div>
                  <div className="z-20 col-span-full row-span-full">
                    <div
                      className="relative w-full overflow-hidden select-none border border-border rounded-sm"
                      style={{
                        height: 'min(780px, 70vh)',
                        minHeight: '650px',
                      }}
                    >
                      <div className="absolute top-0 right-0 bottom-0 left-0 z-10 h-full w-full max-[767px]:pointer-events-none max-[767px]:opacity-0 transition-opacity duration-150">
                        <div className="sr-only" aria-live="polite">
                          This element contains an interactive demo for sighted users showing
                          Tensr&apos;s data transformation and cleaning tools.
                        </div>
                        <div className="absolute inset-0 p-4">
                          <MarketingProductPreview />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="hidden lg:block"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Three-Column Feature Row: Data Quality, Advanced Visualizations, Structural Equation Modeling */}
      <section className="w-full p-0 bg-background text-font">
        <div className="container mx-auto my-8 mb-16">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-stretch mb-4">
            <div className="h-full">
              <div className="bg-card border border-border rounded-sm flex h-full flex-col p-6">
                <div className="text-base flex max-w-prose flex-1 flex-col justify-between">
                  <div>
                    <h2 className="text-base md:text-lg font-normal mb-3">
                      Data Quality & Understanding
                    </h2>
                    <div className="text-muted-foreground text-pretty">
                      <p className="text-base">
                        Advanced data quality checks and understanding tools to ensure your analysis
                        starts with clean, validated data.
                      </p>
                    </div>
                  </div>
                </div>
                <figure className="pt-7">
                  <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-sm">
                    <div className="relative z-10 col-span-full row-span-full overflow-hidden">
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
                        className="aspect-square md:aspect-square"
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: '378px',
                          backgroundColor: 'transparent',
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center"></div>
                      </div>
                    </div>
                  </div>
                </figure>
              </div>
            </div>
            <div className="h-full">
              <div className="bg-card border border-border rounded-sm flex h-full flex-col p-6">
                <div className="text-base flex max-w-prose flex-1 flex-col justify-between">
                  <div>
                    <h2 className="text-base md:text-lg font-normal mb-3">
                      Advanced Visualizations
                    </h2>
                    <div className="text-muted-foreground text-pretty">
                      <p className="text-base">
                        Create rich, interactive visualizations and charts to explore and present
                        your data insights.
                      </p>
                    </div>
                  </div>
                </div>
                <figure className="pt-7">
                  <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-sm">
                    <div className="relative z-10 col-span-full row-span-full overflow-hidden">
                      <picture className="absolute inset-0 scale-[1.1] transform brightness-90 dark:hidden">
                        <source
                          media="(min-width: 901px)"
                          srcSet="https://cdn.sanity.io/images/2hv88549/production/0e44f2d6b59d6d3ab8ea68a301f92e079d0e7e89-2560x1440.png?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/0e44f2d6b59d6d3ab8ea68a301f92e079d0e7e89-2560x1440.png?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/0e44f2d6b59d6d3ab8ea68a301f92e079d0e7e89-2560x1440.png?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/0e44f2d6b59d6d3ab8ea68a301f92e079d0e7e89-2560x1440.png?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/0e44f2d6b59d6d3ab8ea68a301f92e079d0e7e89-2560x1440.png?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/0e44f2d6b59d6d3ab8ea68a301f92e079d0e7e89-2560x1440.png?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/0e44f2d6b59d6d3ab8ea68a301f92e079d0e7e89-2560x1440.png?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/0e44f2d6b59d6d3ab8ea68a301f92e079d0e7e89-2560x1440.png?auto=format&w=3840 3840w"
                        />
                        <img
                          className="object-cover h-full w-full"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="auto"
                          src="https://cdn.sanity.io/images/2hv88549/production/0e44f2d6b59d6d3ab8ea68a301f92e079d0e7e89-2560x1440.png?auto=format"
                        />
                      </picture>
                      <picture className="absolute inset-0 scale-[1.1] transform brightness-90 hidden dark:block">
                        <source
                          media="(min-width: 901px)"
                          srcSet="https://cdn.sanity.io/images/2hv88549/production/23cfd8adb1efe8a6cd2f77479efbbee8b6fd7ad3-2560x1440.png?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/23cfd8adb1efe8a6cd2f77479efbbee8b6fd7ad3-2560x1440.png?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/23cfd8adb1efe8a6cd2f77479efbbee8b6fd7ad3-2560x1440.png?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/23cfd8adb1efe8a6cd2f77479efbbee8b6fd7ad3-2560x1440.png?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/23cfd8adb1efe8a6cd2f77479efbbee8b6fd7ad3-2560x1440.png?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/23cfd8adb1efe8a6cd2f77479efbbee8b6fd7ad3-2560x1440.png?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/23cfd8adb1efe8a6cd2f77479efbbee8b6fd7ad3-2560x1440.png?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/23cfd8adb1efe8a6cd2f77479efbbee8b6fd7ad3-2560x1440.png?auto=format&w=3840 3840w"
                        />
                        <img
                          className="object-cover h-full w-full"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="auto"
                          src="https://cdn.sanity.io/images/2hv88549/production/23cfd8adb1efe8a6cd2f77479efbbee8b6fd7ad3-2560x1440.png?auto=format"
                        />
                      </picture>
                    </div>
                    <div className="z-20 col-span-full row-span-full">
                      <div
                        className="aspect-square md:aspect-square"
                        style={{
                          position: 'relative',
                          width: '100%',
                          backgroundColor: 'transparent',
                          height: '378px',
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center"></div>
                      </div>
                    </div>
                  </div>
                </figure>
              </div>
            </div>
            <div className="h-full">
              <div className="bg-card border border-border rounded-sm flex h-full flex-col p-6">
                <div className="text-base flex max-w-prose flex-1 flex-col justify-between">
                  <div>
                    <h2 className="text-base md:text-lg font-normal mb-3">
                      Structural Equation Modeling
                    </h2>
                    <div className="text-muted-foreground text-pretty">
                      <p className="text-base">
                        Test complex hypotheses and analyze relationships between variables with
                        powerful SEM capabilities.
                      </p>
                    </div>
                  </div>
                </div>
                <figure className="pt-7">
                  <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-sm">
                    <div className="relative z-10 col-span-full row-span-full overflow-hidden">
                      <picture className="absolute inset-0 scale-[1.1] transform brightness-90 dark:hidden">
                        <source
                          media="(min-width: 901px)"
                          srcSet="https://cdn.sanity.io/images/2hv88549/production/214fe44b44ebb3a38c3c7e6bde246a032d1bdc57-2560x1440.png?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/214fe44b44ebb3a38c3c7e6bde246a032d1bdc57-2560x1440.png?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/214fe44b44ebb3a38c3c7e6bde246a032d1bdc57-2560x1440.png?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/214fe44b44ebb3a38c3c7e6bde246a032d1bdc57-2560x1440.png?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/214fe44b44ebb3a38c3c7e6bde246a032d1bdc57-2560x1440.png?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/214fe44b44ebb3a38c3c7e6bde246a032d1bdc57-2560x1440.png?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/214fe44b44ebb3a38c3c7e6bde246a032d1bdc57-2560x1440.png?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/214fe44b44ebb3a38c3c7e6bde246a032d1bdc57-2560x1440.png?auto=format&w=3840 3840w"
                        />
                        <img
                          className="object-cover h-full w-full"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="auto"
                          src="https://cdn.sanity.io/images/2hv88549/production/214fe44b44ebb3a38c3c7e6bde246a032d1bdc57-2560x1440.png?auto=format"
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
                        className="relative w-full overflow-hidden select-none border border-border rounded-sm"
                        style={{ height: '378px' }}
                      >
                        <div
                          className="absolute top-0 right-0 bottom-0 left-0 z-10 h-full w-full max-[767px]:pointer-events-none max-[767px]:opacity-0 transition-opacity duration-150"
                          style={{ opacity: 1 }}
                        >
                          <div className="sr-only" aria-live="polite">
                            Interactive demo showing Tensr&apos;s statistical analysis features and
                            visualizations.
                          </div>
                        </div>
                        <div className="pointer-events-none absolute inset-0 z-20"></div>
                      </div>
                    </div>
                  </div>
                </figure>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three-Column Feature Row: Plugins, Notebooks, Version Control */}
      <section className="w-full p-0 bg-background text-font">
        <div className="container mx-auto my-8 mb-16">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-stretch mb-4">
            <div className="h-full">
              <div className="bg-card border border-border rounded-sm flex h-full flex-col p-6">
                <div className="text-base flex max-w-prose flex-1 flex-col justify-between">
                  <div>
                    <h2 className="text-base md:text-lg font-normal mb-3">Plugins & Extensions</h2>
                    <div className="text-muted-foreground text-pretty">
                      <p className="text-base">
                        Extend Tensr with custom plugins and integrate with external services
                        through our plugin architecture.
                      </p>
                    </div>
                  </div>
                </div>
                <figure className="pt-7">
                  <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-sm">
                    <div className="relative z-10 col-span-full row-span-full overflow-hidden">
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
                        className="relative w-full overflow-hidden select-none border border-border rounded-sm"
                        style={{ height: '378px' }}
                      >
                        <div
                          className="absolute top-0 right-0 bottom-0 left-0 z-10 h-full w-full max-[767px]:pointer-events-none max-[767px]:opacity-0 transition-opacity duration-150"
                          style={{ opacity: 1 }}
                        >
                          <div className="sr-only" aria-live="polite">
                            Interactive demo showing Tensr&apos;s statistical analysis features and
                            visualizations.
                          </div>
                        </div>
                        <div className="pointer-events-none absolute inset-0 z-20"></div>
                      </div>
                    </div>
                  </div>
                </figure>
              </div>
            </div>
            <div className="h-full">
              <div className="bg-card border border-border rounded-sm flex h-full flex-col p-6">
                <div className="text-base flex max-w-prose flex-1 flex-col justify-between">
                  <div>
                    <h2 className="text-base md:text-lg font-normal mb-3">Interactive Notebooks</h2>
                    <div className="text-muted-foreground text-pretty">
                      <p className="text-base">
                        Create interactive documents with code, visuals, and text perfect for
                        research and collaboration.
                      </p>
                    </div>
                  </div>
                </div>
                <figure className="pt-7">
                  <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-sm">
                    <div className="relative z-10 col-span-full row-span-full overflow-hidden">
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
                        className="relative w-full overflow-hidden select-none border border-border rounded-sm"
                        style={{ height: '378px' }}
                      >
                        <div
                          className="absolute top-0 right-0 bottom-0 left-0 z-10 h-full w-full max-[767px]:pointer-events-none max-[767px]:opacity-0 transition-opacity duration-150"
                          style={{ opacity: 1 }}
                        >
                          <div className="sr-only" aria-live="polite">
                            Interactive demo showing Tensr&apos;s statistical analysis features and
                            visualizations.
                          </div>
                        </div>
                        <div className="pointer-events-none absolute inset-0 z-20"></div>
                      </div>
                    </div>
                  </div>
                </figure>
              </div>
            </div>
            <div className="h-full">
              <div className="bg-card border border-border rounded-sm flex h-full flex-col p-6">
                <div className="text-base flex max-w-prose flex-1 flex-col justify-between">
                  <div>
                    <h2 className="text-base md:text-lg font-normal mb-3">Version Control</h2>
                    <div className="text-muted-foreground text-pretty">
                      <p className="text-base">
                        Track changes in your analyses and collaborate with team members using
                        advanced version control features.
                      </p>
                    </div>
                  </div>
                </div>
                <figure className="pt-7">
                  <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-sm">
                    <div className="relative z-10 col-span-full row-span-full overflow-hidden">
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
                        className="relative w-full overflow-hidden select-none border border-border rounded-sm"
                        style={{ height: '378px' }}
                      >
                        <div
                          className="absolute top-0 right-0 bottom-0 left-0 z-10 h-full w-full max-[767px]:pointer-events-none max-[767px]:opacity-0 transition-opacity duration-150"
                          style={{ opacity: 1 }}
                        >
                          <div className="sr-only" aria-live="polite">
                            Interactive demo showing Tensr&apos;s statistical analysis features and
                            visualizations.
                          </div>
                        </div>
                        <div className="pointer-events-none absolute inset-0 z-20"></div>
                      </div>
                    </div>
                  </div>
                </figure>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Plugin Architecture & Extensibility */}
      <section className="w-full p-0 bg-background text-font" id="plugins">
        <div className="container mx-auto mb-16">
          <div className="grid grid-rows-[auto_1fr] gap-4">
            <Link
              className="relative bg-card border border-border rounded-sm p-6 sm:p-7 grid lg:grid-cols-2 gap-4 col-span-full row-span-full"
              href="/features#plugins"
            >
              <div className="lg:flex lg:items-center">
                <div className="max-w-prose w-full">
                  <div className="text-base flex-1">
                    <h2 className="text-base md:text-lg font-normal text-pretty">
                      Plugin architecture and extensibility
                    </h2>
                    <div className="text-base md:text-lg text-muted-foreground text-pretty">
                      <p>
                        Build custom tools with our SDK or use community plugins. Extend Tensr to
                        fit your specific research and analysis needs.
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-primary hover:underline inline-flex items-center gap-1">
                      Learn about plugins →
                    </span>
                  </div>
                </div>
              </div>
              <div className="hidden lg:block"></div>
            </Link>
            <div className="p-7 grid lg:grid-cols-2 gap-4 col-span-full row-span-full">
              <div className="hidden lg:block"></div>
              <div>
                <div className="relative grid grid-cols-1 grid-rows-1 bg-muted rounded-sm">
                  <div className="relative z-10 col-span-full row-span-full overflow-hidden">
                    <picture className="absolute inset-0 scale-[1.1] transform brightness-90">
                      <source
                        media="(min-width: 901px)"
                        srcSet="https://cdn.sanity.io/images/2hv88549/production/00a586c62c8782e65c0affe6363a43ed6bdbc1fd-3139x2093.jpg?auto=format&w=640 640w, https://cdn.sanity.io/images/2hv88549/production/00a586c62c8782e65c0affe6363a43ed6bdbc1fd-3139x2093.jpg?auto=format&w=750 750w, https://cdn.sanity.io/images/2hv88549/production/00a586c62c8782e65c0affe6363a43ed6bdbc1fd-3139x2093.jpg?auto=format&w=828 828w, https://cdn.sanity.io/images/2hv88549/production/00a586c62c8782e65c0affe6363a43ed6bdbc1fd-3139x2093.jpg?auto=format&w=1080 1080w, https://cdn.sanity.io/images/2hv88549/production/00a586c62c8782e65c0affe6363a43ed6bdbc1fd-3139x2093.jpg?auto=format&w=1200 1200w, https://cdn.sanity.io/images/2hv88549/production/00a586c62c8782e65c0affe6363a43ed6bdbc1fd-3139x2093.jpg?auto=format&w=1920 1920w, https://cdn.sanity.io/images/2hv88549/production/00a586c62c8782e65c0affe6363a43ed6bdbc1fd-3139x2093.jpg?auto=format&w=2048 2048w, https://cdn.sanity.io/images/2hv88549/production/00a586c62c8782e65c0affe6363a43ed6bdbc1fd-3139x2093.jpg?auto=format&w=3840 3840w"
                      />
                      <img
                        className="object-cover h-full w-full"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        fetchPriority="auto"
                        src="https://cdn.sanity.io/images/2hv88549/production/00a586c62c8782e65c0affe6363a43ed6bdbc1fd-3139x2093.jpg?auto=format"
                      />
                    </picture>
                  </div>
                  <div className="z-20 col-span-full row-span-full">
                    <div
                      className="relative w-full overflow-hidden select-none border border-border rounded-sm"
                      style={{
                        height: 'min(780px, 70vh)',
                        minHeight: '650px',
                      }}
                    >
                      <div className="absolute top-0 right-0 bottom-0 left-0 z-10 h-full w-full max-[767px]:pointer-events-none max-[767px]:opacity-0 transition-opacity duration-150">
                        <div className="sr-only" aria-live="polite">
                          This element contains an interactive demo showing Tensr&apos;s plugin
                          architecture and extensibility.
                        </div>
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

      {/* Three-Column Feature Row: Notebooks, Visualizations, Collaboration */}
      <section className="w-full p-0 bg-background text-font">
        <div className="container mx-auto mb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-sm p-6 flex flex-col">
              <h3 className="text-base md:text-lg font-normal text-pretty mb-3">
                Interactive Notebooks
              </h3>
              <p className="text-base text-muted-foreground mb-4 flex-1">
                Create interactive documents with code, visuals, and text for research and
                collaboration.
              </p>
              <div className="relative">
                <img
                  src="https://cdn.sanity.io/images/2hv88549/production/ide.jpg?auto=format"
                  alt="Interactive Notebooks"
                  className="w-full h-auto rounded-sm"
                />
              </div>
            </div>
            <div className="bg-card border border-border rounded-sm p-6 flex flex-col">
              <h3 className="text-base md:text-lg font-normal text-pretty mb-3">
                Data Visualizations
              </h3>
              <p className="text-base text-muted-foreground mb-4 flex-1">
                Advanced visualization tools to explore and present your data insights with
                beautiful charts and graphs.
              </p>
              <div className="relative">
                <img
                  src="https://cdn.sanity.io/images/2hv88549/production/cli.jpg?auto=format"
                  alt="Data Visualizations"
                  className="w-full h-auto rounded-sm"
                />
              </div>
            </div>
            <Link
              href="/features#collaboration"
              className="bg-card border border-border rounded-sm p-6 flex flex-col hover:opacity-90 transition-opacity"
            >
              <div className="text-base flex max-w-prose flex-1 flex-col justify-between">
                <div>
                  <h2 className="text-base md:text-lg font-normal mb-3">Team Collaboration</h2>
                  <div className="text-muted-foreground text-pretty">
                    <p className="text-base">
                      Work together on analyses with shared workspaces and real-time collaboration.
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-primary hover:underline inline-flex items-center gap-1">
                    Learn more →
                  </span>
                </div>
              </div>
              <figure className="pt-7">
                <div className="relative grid grid-cols-1 grid-rows-1 bg-card rounded-sm">
                  <div className="relative z-10 col-span-full row-span-full overflow-hidden">
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
                      className="relative w-full overflow-hidden select-none border border-border rounded-sm"
                      style={{ height: '378px' }}
                    >
                      <div
                        className="absolute top-0 right-0 bottom-0 left-0 z-10 h-full w-full max-[767px]:pointer-events-none max-[767px]:opacity-0 transition-opacity duration-150"
                        style={{ opacity: 1 }}
                      >
                        <div className="sr-only" aria-live="polite">
                          This element contains an interactive demo for sighted users showing
                          Tensr&apos;s collaboration features and team workspaces.
                        </div>
                      </div>
                      <div className="pointer-events-none absolute inset-0 z-20"></div>
                    </div>
                  </div>
                </div>
              </figure>
            </Link>
          </div>
        </div>
      </section>

      {/* Cloud-native and accessible */}
      <section className="w-full p-0 bg-background text-font">
        <div className="container mx-auto mb-16">
          <div className="text-center mb-8">
            <h2 className="text-base md:text-lg font-normal text-pretty mb-4">
              Cloud-native and accessible
            </h2>
            <p className="text-base text-muted-foreground mb-6">
              Access Tensr from anywhere, collaborate with your team, and scale your analysis
              workflow.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-sm flex flex-col items-center justify-center p-8">
              <div className="mb-4">
                <div className="h-12 w-12 bg-primary rounded flex items-center justify-center">
                  <span className="text-white text-xl">☁️</span>
                </div>
              </div>
              <h3 className="text-base font-normal mb-2">Cloud-native architecture</h3>
              <p className="text-base text-muted-foreground text-center">
                Built for the cloud with scalable infrastructure and seamless access from any
                device.
              </p>
            </div>
            <div className="bg-card border border-border rounded-sm flex flex-col items-center justify-center p-8">
              <div className="mb-4 flex items-center justify-center gap-4">
                <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
                  <span className="text-white text-sm">🔌</span>
                </div>
                <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
                  <span className="text-white text-sm">📊</span>
                </div>
                <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
                  <span className="text-white text-sm">🔗</span>
                </div>
                <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
                  <span className="text-white text-sm">⚙️</span>
                </div>
              </div>
              <h3 className="text-base font-normal mb-2">Integrations & Plugins</h3>
              <p className="text-base text-muted-foreground text-center">
                Connect with external data sources and extend functionality with our plugin SDK.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 md:py-48 px-4 md:px-8 bg-background text-font">
        <div className="container mx-auto">
          <div className="text-center mx-auto max-w-4xl">
            <h2 className="text-6xl sm:text-7xl font-normal text-balance mx-auto mb-4">
              Get started with Tensr.
            </h2>
            <div className="gap-x-4 flex items-center justify-center">
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
      </section>
    </main>
  );
};

export default FeaturesTemplate;
