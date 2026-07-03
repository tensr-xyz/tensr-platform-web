'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Star, Download, Zap, Check, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { PluginRecord } from '@/types/plugin';
import usePlugins from '@/hooks/api/use-plugin';
import { Loader } from '@/components/molecules/loading';
import { cn } from '@/utils';

const DISCOVER_FILTERS = ['all', 'work', 'life', 'school'] as const;
type DiscoverFilter = (typeof DISCOVER_FILTERS)[number];

const DISCOVER_LABELS: Record<DiscoverFilter, string> = {
  all: 'All',
  work: 'Work',
  life: 'Life',
  school: 'School',
};

const PLUGIN_COLORS = [
  'hsl(250, 100%, 63%)',
  '#0EA5E9',
  '#16A34A',
  '#EA580C',
  '#DB2777',
  '#7C3AED',
  '#0F766E',
  '#9333EA',
  '#CA8A04',
];

const LANG_COLORS: Record<string, string> = {
  python: '#3776AB',
  r: '#198CE7',
  javascript: '#F7DF1E',
  typescript: '#3178C6',
};

function pluginColor(pluginId: string): string {
  let hash = 0;
  for (let i = 0; i < pluginId.length; i++) hash += pluginId.charCodeAt(i);
  return PLUGIN_COLORS[hash % PLUGIN_COLORS.length];
}

function formatPrice(plugin: PluginRecord): string {
  if (!plugin.isPaid) return 'Free';
  const price = plugin.pricing?.price;
  const interval = plugin.pricing?.subscriptionInterval;
  if (price == null) return 'Paid';
  const formatted = `$${price}`;
  return interval === 'monthly'
    ? `${formatted}/mo`
    : interval === 'yearly'
      ? `${formatted}/yr`
      : formatted;
}

function formatDownloads(n?: number): string {
  const count = n ?? 0;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function DiscoverPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function LangChip({ lang }: { lang: string }) {
  const key = lang.toLowerCase();
  const label = lang.charAt(0).toUpperCase() + lang.slice(1);
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: LANG_COLORS[key] ?? '#888' }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function PluginCardThumb({ color, pluginId }: { color: string; pluginId: string }) {
  return (
    <div
      className="relative flex h-[120px] items-end overflow-hidden p-4"
      style={{
        background: `linear-gradient(135deg, ${color} 0%, color-mix(in oklab, ${color} 40%, black) 100%)`,
      }}
    >
      <svg className="pointer-events-none absolute inset-0 size-full opacity-[0.18]" aria-hidden>
        <defs>
          <pattern
            id={`p-${pluginId}`}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(20)"
          >
            <circle cx="10" cy="10" r="1" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#p-${pluginId})`} />
      </svg>
      <div
        className="relative grid size-11 place-items-center rounded-lg bg-white shadow-md"
        style={{ color }}
      >
        <Zap className="size-5" aria-hidden />
      </div>
    </div>
  );
}

function PluginCard({
  plugin,
  onInstall,
  onViewDetails,
  isInstalled,
  installing,
}: {
  plugin: PluginRecord;
  onInstall: (plugin: PluginRecord) => void;
  onViewDetails: (plugin: PluginRecord) => void;
  isInstalled: boolean;
  installing: boolean;
}) {
  const color = pluginColor(plugin.pluginId);
  const price = formatPrice(plugin);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
      <PluginCardThumb color={color} pluginId={plugin.pluginId} />
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onViewDetails(plugin)}
            className="text-left text-sm font-medium text-foreground hover:underline"
          >
            {plugin.name}
          </button>
          <span
            className={cn(
              'shrink-0 font-mono text-[11px]',
              price === 'Free' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
            )}
          >
            {price}
          </span>
        </div>
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{plugin.authorId}</span>
          <span>·</span>
          <LangChip lang={plugin.language} />
        </div>
        <p className="line-clamp-2 flex-1 text-[13px] leading-snug text-muted-foreground">
          {plugin.description}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
              <span className="font-mono tabular-nums">4.6</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Download className="size-3" aria-hidden />
              <span className="font-mono tabular-nums">
                {formatDownloads(plugin.revenue?.totalDownloads)}
              </span>
            </span>
          </div>
          {isInstalled ? (
            <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="size-3" aria-hidden />
              Installed
            </span>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={installing || plugin.status !== 'APPROVED'}
              className="h-8 shrink-0 rounded-full px-3 text-xs"
              onClick={() => onInstall(plugin)}
            >
              {installing ? '…' : price === 'Free' ? 'Install' : 'Get'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FeaturedPlugin({
  plugin,
  onInstall,
  isInstalled,
}: {
  plugin: PluginRecord;
  onInstall: (plugin: PluginRecord) => void;
  isInstalled: boolean;
}) {
  const color = pluginColor(plugin.pluginId);
  const router = useRouter();

  return (
    <div className="mb-8 grid w-full overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col justify-between p-6 md:p-8">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-[11px] font-medium text-primary">
              Editor&apos;s pick
            </span>
            <LangChip lang={plugin.language} />
          </div>
          <h2 className="text-2xl font-medium tracking-tight text-foreground">{plugin.name}</h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            {plugin.description}
          </p>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {isInstalled ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-600">
              <Check className="size-3.5" aria-hidden />
              Installed
            </span>
          ) : (
            <Button className="h-9 rounded-full px-4" onClick={() => onInstall(plugin)}>
              Install plugin
            </Button>
          )}
          <Button
            variant="outline"
            className="h-9 rounded-full"
            onClick={() => router.push(`/plugins/${plugin.pluginId}`)}
          >
            View details
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground sm:ml-auto">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
              <span className="font-mono tabular-nums">4.8</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Download className="size-3" aria-hidden />
              <span className="font-mono tabular-nums">
                {formatDownloads(plugin.revenue?.totalDownloads)}
              </span>
            </span>
          </div>
        </div>
      </div>
      <div
        className="relative min-h-[200px] overflow-hidden p-6 lg:min-h-[280px]"
        style={{
          background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 50%, black))`,
        }}
      >
        <div
          className="absolute bottom-6 left-6 right-6 rounded-xl border border-white/15 bg-black/35 p-3.5 font-mono text-xs leading-relaxed text-white/90 backdrop-blur-sm"
          aria-hidden
        >
          <div className="text-white/60">
            $ tensr plugin install {plugin.pluginId.slice(0, 12)}…
          </div>
          <div>✓ Fetching manifest…</div>
          <div>✓ Installed statistical operators</div>
        </div>
      </div>
    </div>
  );
}

export default function PluginsLayout() {
  const router = useRouter();
  const { plugins, isPluginInstalled, installPlugin, loading, error } = usePlugins();
  const [search, setSearch] = useState('');
  const [discoverFilter, setDiscoverFilter] = useState<DiscoverFilter>('all');
  const [installingId, setInstallingId] = useState<string | null>(null);

  const filteredPlugins = useMemo(() => {
    return plugins.filter(plugin => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !plugin.name.toLowerCase().includes(q) &&
          !plugin.description.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (discoverFilter !== 'all') {
        const tags = (plugin.tags ?? []).map(t => t.toLowerCase());
        if (tags.length > 0 && !tags.includes(discoverFilter)) return false;
      }
      return true;
    });
  }, [plugins, search, discoverFilter]);

  const featuredPlugin = useMemo(() => {
    if (filteredPlugins.length === 0) return null;
    return [...filteredPlugins].sort(
      (a, b) => (b.revenue?.totalDownloads ?? 0) - (a.revenue?.totalDownloads ?? 0)
    )[0];
  }, [filteredPlugins]);

  const gridPlugins = useMemo(() => {
    if (!featuredPlugin) return filteredPlugins;
    return filteredPlugins.filter(p => p.pluginId !== featuredPlugin.pluginId);
  }, [filteredPlugins, featuredPlugin]);

  const handleInstall = async (plugin: PluginRecord) => {
    try {
      setInstallingId(plugin.pluginId);
      if (plugin.isPaid) {
        router.push(`/plugins/${plugin.pluginId}/purchase`);
      } else {
        await installPlugin(plugin);
      }
    } catch (err) {
      console.error('Error installing plugin:', err);
    } finally {
      setInstallingId(null);
    }
  };

  const handleViewDetails = (plugin: PluginRecord) => {
    router.push(`/plugins/${plugin.pluginId}`);
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  if (error) {
    return (
      <div className="w-full py-12 text-left">
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const hasFilters = search.length > 0 || discoverFilter !== 'all';
  const isMarketplaceEmpty = plugins.length === 0;
  const isFilterEmpty = !isMarketplaceEmpty && filteredPlugins.length === 0;

  return (
    <div className="w-full pb-10 text-left">
      <header className="mb-8 pt-6 md:pt-8">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Plugin marketplace
        </p>
        <h1 className="text-2xl font-medium tracking-tight text-foreground md:text-3xl">
          Discover
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Extend your agent and add analysis capabilities. {plugins.length} plugins, free and paid,
          built by the community.
        </p>
      </header>

      <section className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {DISCOVER_FILTERS.map(key => (
              <DiscoverPill
                key={key}
                active={discoverFilter === key}
                onClick={() => setDiscoverFilter(key)}
              >
                {DISCOVER_LABELS[key]}
                {key === 'all' ? (
                  <span
                    className={cn(
                      'font-mono text-[10px]',
                      discoverFilter === key
                        ? 'text-primary-foreground/70'
                        : 'text-muted-foreground/80'
                    )}
                  >
                    {plugins.length}
                  </span>
                ) : null}
              </DiscoverPill>
            ))}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Try 'time series'…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 rounded-full border-border bg-background pl-9 text-[13px] shadow-none"
              />
            </div>
            <Button variant="outline" className="h-9 shrink-0 gap-2 rounded-full" asChild>
              <Link href="/plugins/upload">
                <Plus className="size-4" aria-hidden />
                Publish
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {isMarketplaceEmpty ? (
        <div className="rounded-xl border border-border bg-card p-8 md:p-12">
          <h3 className="text-lg font-medium text-foreground">No plugins in the marketplace yet</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Be the first to publish a plugin, or check back soon as creators add new analysis tools.
          </p>
          <Button className="mt-6 rounded-full" asChild>
            <Link href="/plugins/upload">Publish a plugin</Link>
          </Button>
        </div>
      ) : isFilterEmpty ? (
        <div className="rounded-xl border border-border bg-card p-8 md:p-12">
          <Search className="mb-3 size-8 text-muted-foreground/50" aria-hidden />
          <h3 className="text-lg font-medium text-foreground">No plugins match your filters</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your search or category filters.
          </p>
          {hasFilters ? (
            <Button
              variant="outline"
              className="mt-4 rounded-full"
              onClick={() => {
                setSearch('');
                setDiscoverFilter('all');
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {featuredPlugin ? (
            <FeaturedPlugin
              plugin={featuredPlugin}
              onInstall={handleInstall}
              isInstalled={isPluginInstalled(featuredPlugin.pluginId)}
            />
          ) : null}

          {gridPlugins.length > 0 ? (
            <>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium tracking-tight text-foreground">
                    Featured plugins
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Hand-picked by the Tensr team.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  View all
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
              <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {gridPlugins.slice(0, 4).map(plugin => (
                  <PluginCard
                    key={plugin.pluginId}
                    plugin={plugin}
                    onInstall={handleInstall}
                    onViewDetails={handleViewDetails}
                    isInstalled={isPluginInstalled(plugin.pluginId)}
                    installing={installingId === plugin.pluginId}
                  />
                ))}
              </div>

              {gridPlugins.length > 4 ? (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      All plugins
                    </h2>
                    <span className="font-mono text-xs text-muted-foreground">
                      {gridPlugins.length} results
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {gridPlugins.slice(4).map(plugin => (
                      <PluginCard
                        key={plugin.pluginId}
                        plugin={plugin}
                        onInstall={handleInstall}
                        onViewDetails={handleViewDetails}
                        isInstalled={isPluginInstalled(plugin.pluginId)}
                        installing={installingId === plugin.pluginId}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
