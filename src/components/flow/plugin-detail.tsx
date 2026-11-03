'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';
import {
  ageLabel,
  apiErrorText,
  initialOf,
  installLabel,
  languageLabel,
  permissionLines,
  shortDate,
  trialLine,
  type PluginRecord,
} from './plugin-pages';
import { PluginInstallDialog } from './plugin-install-dialog';
import './plugins-pages.css';

type Access = { isPaid?: boolean; hasAccess?: boolean; isInstalled?: boolean };

export function PluginDetail({ pluginId }: { pluginId: string }) {
  const [plugin, setPlugin] = useState<PluginRecord | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(() => {
    setPhase('loading');
    const id = encodeURIComponent(pluginId);
    void Promise.all([
      flowJson<PluginRecord>(`/plugins/${id}`),
      flowJson<Access>(`/plugins/${id}/access`).catch(() => null),
    ])
      .then(([record, rights]) => {
        setPlugin(record);
        setAccess(rights);
        setPhase('ready');
      })
      .catch(reason => {
        setError(apiErrorText(reason, 'Could not load this plugin.'));
        setPhase('error');
      });
  }, [pluginId]);

  useEffect(() => {
    load();
  }, [load]);

  const installed = Boolean(access?.isInstalled);
  const needsPurchase = Boolean(plugin?.isPaid) && !access?.hasAccess;

  const install = () => {
    if (!plugin) return;
    if (needsPurchase) {
      setDialogOpen(true);
      return;
    }
    setBusy(true);
    setActionError(null);
    void flowJson(`/plugins/${encodeURIComponent(plugin.pluginId)}/install`, { method: 'POST' })
      .then(() => setAccess(current => ({ ...(current || {}), isInstalled: true })))
      .catch(reason => setActionError(apiErrorText(reason, 'Could not install this plugin.')))
      .finally(() => setBusy(false));
  };

  const uninstall = () => {
    if (!plugin) return;
    setBusy(true);
    setActionError(null);
    void flowJson(`/plugins/${encodeURIComponent(plugin.pluginId)}/install`, { method: 'DELETE' })
      .then(() => setAccess(current => ({ ...(current || {}), isInstalled: false })))
      .catch(reason => setActionError(apiErrorText(reason, 'Could not uninstall this plugin.')))
      .finally(() => setBusy(false));
  };

  if (phase === 'loading') {
    return (
      <div className="pg-page" aria-busy="true">
        <Skeleton className="pg-sk-crumb" />
        <div className="pg-head">
          <Skeleton className="pg-tile" />
          <div className="pg-head-text">
            <Skeleton className="pg-sk-title" />
            <Skeleton className="pg-sk-line" />
            <Skeleton className="pg-sk-line short" />
          </div>
        </div>
        <div className="pg-body">
          <div className="pg-main">
            <Skeleton className="pg-sk-block" />
          </div>
          <div className="pg-rail">
            <Skeleton className="pg-sk-card" />
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'error' || !plugin) {
    return (
      <div className="pg-page">
        <div className="pg-crumb">
          <Link href="/flow/plugins">Plugins</Link>
        </div>
        <p className="flow-error">{error || 'Could not load this plugin.'}</p>
        <Button className="flow-btn pg-fit" type="button" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  const language = languageLabel(plugin.language);
  const updated = ageLabel(plugin.updatedAt || plugin.createdAt);
  const installs = plugin.revenue?.totalDownloads || 0;
  const category = (plugin.tags || [])[0];
  const permissions = permissionLines(plugin.capabilities);
  const trial = plugin.isPaid && !installed ? trialLine(plugin.pricing) : null;
  const support = plugin.manifest?.authorEmail || null;
  const reviewed = plugin.status === 'APPROVED' ? shortDate(plugin.reviewedAt) : null;

  const meta = [
    plugin.authorName ? `by ${plugin.authorName}` : null,
    installs > 0 ? `${installs} install${installs === 1 ? '' : 's'}` : null,
    category || null,
    [plugin.version ? `v${plugin.version}` : null, updated ? `updated ${updated} ago` : null]
      .filter(Boolean)
      .join(' · ') || null,
  ].filter(Boolean) as string[];

  const info: { label: string; value: string; accent?: boolean }[] = [];
  if (language) info.push({ label: 'Language', value: language });
  info.push({ label: 'Runs on', value: 'Inside Tensr' });
  if (plugin.status === 'APPROVED') {
    info.push({
      label: 'Reviewed by Tensr',
      value: reviewed ? `Passed · ${reviewed}` : 'Passed',
      accent: true,
    });
  } else if (plugin.status === 'PENDING') {
    info.push({ label: 'Reviewed by Tensr', value: 'In review' });
  }
  if (support) info.push({ label: 'Support', value: support });

  return (
    <div className="pg-page">
      <nav className="pg-crumb" aria-label="Breadcrumb">
        <Link href="/flow/plugins">Plugins</Link>
        <span aria-hidden="true"> › </span>
        <span>{plugin.name}</span>
      </nav>

      <div className="pg-head">
        <div className="pg-head-left">
          <div className="pg-tile" aria-hidden="true">
            {initialOf(plugin.name)}
          </div>
          <div className="pg-head-text">
            <h1 className="pg-title">{plugin.name}</h1>
            {plugin.description ? <p className="pg-lead">{plugin.description}</p> : null}
            {meta.length ? (
              <div className="pg-meta">
                {meta.map(item => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="pg-head-action">
          {installed ? (
            <Button className="flow-btn pg-btn" type="button" disabled={busy} onClick={uninstall}>
              {busy ? 'Removing' : 'Uninstall'}
            </Button>
          ) : (
            <Button
              className="flow-btn primary pg-btn"
              type="button"
              disabled={busy || plugin.status !== 'APPROVED'}
              onClick={install}
            >
              {busy ? 'Installing' : needsPurchase ? installLabel(plugin) : 'Install'}
            </Button>
          )}
          {installed ? <span className="pg-note">Installed</span> : null}
          {trial ? <span className="pg-note">{trial}</span> : null}
          {actionError ? <span className="flow-error pg-note">{actionError}</span> : null}
        </div>
      </div>

      <div className="pg-body">
        <div className="pg-main">
          {plugin.thumbnailUrl ? (
            <div className="pg-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={plugin.thumbnailUrl} alt={`${plugin.name} preview`} />
            </div>
          ) : null}
          {plugin.description ? (
            <section className="pg-section">
              <h2 className="pg-h2">What it does</h2>
              <p className="pg-text">{plugin.description}</p>
            </section>
          ) : null}
          {permissions.length ? (
            <section className="pg-section">
              <h2 className="pg-h2">What it can see</h2>
              <div className="pg-box">
                {permissions.map(line => (
                  <div key={line.text} className={line.allowed ? 'pg-perm' : 'pg-perm off'}>
                    {line.allowed ? '✓' : '✕'} {line.text}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <aside className="pg-rail">
          <div className="pg-card">
            {info.map(row => (
              <div key={row.label} className="pg-row">
                <span className="pg-muted">{row.label}</span>
                <span className={row.accent ? 'pg-accent' : undefined}>{row.value}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <PluginInstallDialog
        plugin={plugin}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onInstalled={() => {
          setDialogOpen(false);
          setAccess(current => ({ ...(current || {}), hasAccess: true, isInstalled: true }));
        }}
      />
    </div>
  );
}
