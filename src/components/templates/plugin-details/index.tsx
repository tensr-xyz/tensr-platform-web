'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Loader } from '@/components/molecules/loading';
import usePlugins from '@/hooks/api/use-plugin';
import { apiClient } from '@/lib/api-client';
import type { PluginRecord } from '@/types/plugin';

function Section({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="border-b border-border px-6 py-4">
        <h3 className="text-base font-medium">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-4 p-6 text-sm">{children}</div>
      {footer ? (
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-6 py-4">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span> {value}
    </div>
  );
}

function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'info';
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : tone === 'warning'
        ? 'bg-amber-500/10 text-amber-800 dark:text-amber-400'
        : tone === 'info'
          ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
          : 'border border-border text-muted-foreground';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

export default function PluginDetails() {
  const params = useParams();
  const router = useRouter();
  const { getPlugin } = usePlugins();

  const [plugin, setPlugin] = useState<PluginRecord | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.pluginId) {
      fetchPlugin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per plugin id
  }, [params.pluginId]);

  const fetchPlugin = async () => {
    try {
      const pluginData = await getPlugin(params.pluginId as string);
      setPlugin(pluginData);
      try {
        const access = await apiClient.plugins.access(pluginData.pluginId);
        setHasAccess(access.hasAccess);
        setIsInstalled(Boolean(access.isInstalled));
      } catch {
        setHasAccess(!pluginData.isPaid);
        setIsInstalled(false);
      }
    } catch {
      setError('Failed to load plugin');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWorkspace = () => {
    if (!plugin || !isInstalled) return;
    router.push('/workspace');
  };

  const handlePurchase = () => {
    if (!plugin) return;
    router.push(`/plugins/${plugin.pluginId}/purchase`);
  };

  const handleInstall = async () => {
    if (!plugin) return;
    setBusy(true);
    try {
      await apiClient.plugins.install(plugin.pluginId);
      setIsInstalled(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Install failed');
    } finally {
      setBusy(false);
    }
  };

  const handleUninstall = async () => {
    if (!plugin) return;
    setBusy(true);
    try {
      await apiClient.plugins.uninstall(plugin.pluginId);
      setIsInstalled(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Uninstall failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <Loader centered message="Loading plugin…" />;
  }

  if (error || !plugin) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6">
        <div className="text-center">
          <h2 className="text-lg font-medium tracking-tight text-red-600">Plugin not found</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error || 'The requested plugin could not be found.'}
          </p>
        </div>
        <div className="flex justify-center">
          <Button variant="outline" size="sm" asChild>
            <Link href="/plugins">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Marketplace
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const isApproved = plugin.status === 'APPROVED';
  const updatedLabel = new Date(plugin.updatedAt || plugin.createdAt).toLocaleDateString();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/plugins">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Marketplace
            </Link>
          </Button>
          <h2 className="mt-4 text-lg font-medium tracking-tight">{plugin.name}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{plugin.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill tone={isApproved ? 'success' : 'warning'}>{plugin.status}</StatusPill>
            {plugin.isPaid ? <StatusPill>Paid</StatusPill> : <StatusPill>Free</StatusPill>}
            {plugin.isPaid && hasAccess ? <StatusPill tone="info">Owned</StatusPill> : null}
            {isInstalled ? <StatusPill tone="info">Installed</StatusPill> : null}
            <span className="text-xs text-muted-foreground">
              v{plugin.version} · <code className="text-[11px]">{plugin.pluginId}</code>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {plugin.thumbnailUrl ? (
            <section className="overflow-hidden rounded-lg border border-border bg-background">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={plugin.thumbnailUrl}
                alt={plugin.name}
                className="h-52 w-full object-cover"
              />
            </section>
          ) : null}

          <Section title="About" description="What this plugin does">
            <p className="text-muted-foreground leading-relaxed">{plugin.description}</p>
            {plugin.tags && plugin.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {plugin.tags.map(tag => (
                  <span
                    key={tag}
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </Section>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Section title="Technical details" description="Runtime and package metadata">
              <div className="grid grid-cols-1 gap-2 text-muted-foreground">
                <MetaRow
                  label="Entry"
                  value={<code className="text-xs">{plugin.entryPoint}</code>}
                />
                <MetaRow label="Version" value={`v${plugin.version}`} />
                <MetaRow label="License" value={plugin.license || 'Not specified'} />
                <MetaRow label="Language" value={plugin.language} />
                <MetaRow label="Filesystem" value={plugin.capabilities?.filesystem || 'none'} />
                <MetaRow label="Memory" value={`${plugin.capabilities?.maxMemoryMb ?? '—'} MB`} />
                <MetaRow
                  label="Timeout"
                  value={`${plugin.capabilities?.maxExecutionSeconds ?? '—'}s`}
                />
                <MetaRow
                  label="Data access"
                  value={(plugin.capabilities?.dataAccess || []).join(', ') || '—'}
                />
              </div>
            </Section>

            {plugin.capabilities ? (
              <Section title="Capabilities" description="Supported inputs and outputs">
                <div className="space-y-3">
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">Input types</p>
                    <div className="flex flex-wrap gap-2">
                      {plugin.capabilities.inputTypes.map(type => (
                        <span
                          key={type}
                          className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">Output types</p>
                    <div className="flex flex-wrap gap-2">
                      {plugin.capabilities.outputTypes.map(type => (
                        <span
                          key={type}
                          className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>
            ) : null}
          </div>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Section
            title="Get started"
            description={
              plugin.isPaid && !hasAccess
                ? 'Purchase first, then install to add it to your workspace.'
                : isInstalled
                  ? 'Installed — run it from the Analysis command palette.'
                  : 'Install to add this plugin to your workspace (like an editor extension).'
            }
            footer={
              <div className="flex w-full flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  {plugin.isPaid && plugin.pricing ? (
                    <>
                      ${plugin.pricing.price}
                      {plugin.pricing.model === 'subscription'
                        ? ` / ${plugin.pricing.subscriptionInterval}`
                        : null}
                      {plugin.pricing.trialDays && plugin.pricing.trialDays > 0
                        ? ` · ${plugin.pricing.trialDays}-day trial`
                        : null}
                    </>
                  ) : (
                    'Free — install only if you want it active'
                  )}
                </p>
                {!isApproved ? (
                  <Button disabled className="w-full">
                    Pending review
                  </Button>
                ) : plugin.isPaid && !hasAccess ? (
                  <Button onClick={handlePurchase} className="w-full">
                    <Lock className="mr-2 h-4 w-4" />
                    Purchase
                  </Button>
                ) : isInstalled ? (
                  <>
                    <Button onClick={handleOpenWorkspace} className="w-full" disabled={busy}>
                      Open in workspace
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleUninstall}
                      className="w-full"
                      disabled={busy}
                    >
                      {busy ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader className="!size-4 !stroke-[2]" size="sm" />
                          Uninstalling…
                        </span>
                      ) : (
                        'Uninstall'
                      )}
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleInstall} className="w-full" disabled={busy}>
                    {busy ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader className="!size-4 !stroke-[2]" size="sm" />
                        Installing…
                      </span>
                    ) : (
                      'Install'
                    )}
                  </Button>
                )}
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-2 text-muted-foreground">
              <MetaRow label="Author" value={plugin.authorId} />
              <MetaRow label="Language" value={plugin.language} />
              <MetaRow label="Updated" value={updatedLabel} />
              <MetaRow
                label="Status"
                value={
                  !isApproved
                    ? 'Awaiting approval'
                    : plugin.isPaid && !hasAccess
                      ? 'Purchase required'
                      : isInstalled
                        ? 'Installed'
                        : 'Not installed'
                }
              />
            </div>
            {plugin.revenue ? (
              <p className="text-xs text-muted-foreground">
                Downloads: {plugin.revenue.totalDownloads.toLocaleString()}
                {plugin.isPaid ? ` · Revenue: $${plugin.revenue.totalSales.toFixed(2)}` : null}
              </p>
            ) : null}
          </Section>

          <Section title="Version" description="Current published version">
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium">v{plugin.version}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(plugin.createdAt).toLocaleDateString()}
                </p>
              </div>
              <StatusPill tone="info">Current</StatusPill>
            </div>
          </Section>

          {plugin.isPaid && plugin.pricing ? (
            <Section title="Pricing" description="What you pay for this plugin">
              <div className="grid grid-cols-1 gap-2 text-muted-foreground">
                <MetaRow
                  label="Price"
                  value={
                    <>
                      ${plugin.pricing.price}
                      {plugin.pricing.model === 'subscription'
                        ? ` / ${plugin.pricing.subscriptionInterval}`
                        : null}
                    </>
                  }
                />
                <MetaRow label="Model" value={plugin.pricing.model} />
                {plugin.pricing.trialDays && plugin.pricing.trialDays > 0 ? (
                  <MetaRow label="Trial" value={`${plugin.pricing.trialDays} days`} />
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Platform fee: 10% (automatically deducted from creator payouts)
              </p>
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
