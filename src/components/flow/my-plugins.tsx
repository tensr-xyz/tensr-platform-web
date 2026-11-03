'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/rest';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { flowJson } from '@/lib/flow-api';
import {
  apiErrorText,
  initialOf,
  languageLabel,
  money,
  priceLabel,
  reviewState,
  shortDate,
  visibilityLabel,
  type PluginPricing,
  type PluginRecord,
} from './plugin-pages';
import './plugins-pages.css';

type InstalledRow = {
  pluginId: string;
  version?: string;
  installedAt?: string;
  plugin?: PluginRecord;
};

/** GET /creator/plugins row. `downloads` counts completed purchases. */
type PublishedRow = {
  pluginId: string;
  name?: string;
  status?: string;
  isPaid?: boolean;
  pricing?: PluginPricing | null;
  downloads?: number;
  revenue?: number;
  createdAt?: string;
  lastUpdated?: string;
};

type Tab = 'installed' | 'published';

export function MyPlugins() {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<InstalledRow[]>([]);
  const [published, setPublished] = useState<PublishedRow[]>([]);
  const [tab, setTab] = useState<Tab>('installed');
  const [removing, setRemoving] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = useCallback(() => {
    setPhase('loading');
    void Promise.all([
      flowJson<{ items?: InstalledRow[] }>('/plugins/installed'),
      flowJson<PublishedRow[]>('/creator/plugins'),
    ])
      .then(([mine, theirs]) => {
        setInstalled(mine.items || []);
        setPublished(Array.isArray(theirs) ? theirs : []);
        setPhase('ready');
      })
      .catch(reason => {
        setError(apiErrorText(reason, 'Could not load your plugins.'));
        setPhase('error');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uninstall = (pluginId: string) => {
    setRemoving(pluginId);
    setRowError(null);
    void flowJson(`/plugins/${encodeURIComponent(pluginId)}/install`, { method: 'DELETE' })
      .then(() => setInstalled(rows => rows.filter(row => row.pluginId !== pluginId)))
      .catch(reason => setRowError(apiErrorText(reason, 'Could not uninstall this plugin.')))
      .finally(() => setRemoving(null));
  };

  const ready = phase === 'ready';
  const anyPaid = published.some(row => row.isPaid);

  return (
    <div className="pg-page">
      <div className="pg-top">
        <div className="pg-top-text">
          <nav className="pg-crumb" aria-label="Breadcrumb">
            <Link href="/flow/plugins">Plugins</Link>
            <span aria-hidden="true"> › </span>
            <span>Mine</span>
          </nav>
          <h1 className="pg-page-title">My plugins</h1>
        </div>
        <Link className="flow-btn primary pg-btn pg-link-btn" href="/flow/plugins/publish">
          + Publish a plugin
        </Link>
      </div>

      <Tabs value={tab} onValueChange={value => setTab(value as Tab)} className="pg-tabs">
        <TabsList className="pg-tablist">
          <TabsTrigger value="installed" isClosable={false} className="pg-tab">
            Installed{ready ? ` · ${installed.length}` : ''}
          </TabsTrigger>
          <TabsTrigger value="published" isClosable={false} className="pg-tab">
            Published{ready ? ` · ${published.length}` : ''}
          </TabsTrigger>
        </TabsList>

        {phase === 'loading' ? (
          <div className="pg-table-wrap" aria-busy="true">
            <Skeleton className="pg-sk-row" />
            <Skeleton className="pg-sk-row" />
            <Skeleton className="pg-sk-row" />
          </div>
        ) : phase === 'error' ? (
          <div className="pg-stack">
            <p className="flow-error">{error || 'Could not load your plugins.'}</p>
            <Button className="flow-btn pg-fit" type="button" onClick={load}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <TabsContent value="installed">
              {installed.length === 0 ? (
                <div className="pg-empty">
                  <p>You haven&apos;t installed any plugins yet.</p>
                  <Link className="pg-accent" href="/flow/plugins">
                    Browse plugins
                  </Link>
                </div>
              ) : (
                <div className="pg-table-wrap">
                  {installed.map(row => {
                    const plugin = row.plugin;
                    const name = plugin?.name || row.pluginId;
                    const sub = [
                      plugin?.authorName ? `by ${plugin.authorName}` : null,
                      languageLabel(plugin?.language),
                      row.version || plugin?.version ? `v${row.version || plugin?.version}` : null,
                      shortDate(row.installedAt) ? `installed ${shortDate(row.installedAt)}` : null,
                    ].filter(Boolean);
                    return (
                      <div key={row.pluginId} className="pg-list-row">
                        <div className="pg-tile small" aria-hidden="true">
                          {initialOf(name)}
                        </div>
                        <div className="pg-grow">
                          <Link className="pg-row-name" href={`/flow/plugins/${row.pluginId}`}>
                            {name}
                          </Link>
                          {sub.length ? <div className="pg-sub">{sub.join(' · ')}</div> : null}
                        </div>
                        <Button
                          className="flow-btn pg-btn"
                          type="button"
                          disabled={removing === row.pluginId}
                          onClick={() => uninstall(row.pluginId)}
                        >
                          {removing === row.pluginId ? 'Removing' : 'Uninstall'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              {rowError ? <p className="flow-error">{rowError}</p> : null}
            </TabsContent>

            <TabsContent value="published">
              {published.length === 0 ? (
                <div className="pg-empty">
                  <p>You haven&apos;t published a plugin yet.</p>
                  <Link className="pg-accent" href="/flow/plugins/publish">
                    Publish your first plugin
                  </Link>
                </div>
              ) : (
                <>
                  <div className="pg-table-wrap">
                    <Table className="pg-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Plugin</TableHead>
                          <TableHead className="pg-col-vis">Visibility</TableHead>
                          <TableHead className="pg-col-review">Review</TableHead>
                          <TableHead className="pg-num">Purchases</TableHead>
                          <TableHead className="pg-num">Price</TableHead>
                          {anyPaid ? <TableHead className="pg-num">Earned</TableHead> : null}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {published.map(row => {
                          const review = reviewState(row.status);
                          const price = row.isPaid ? priceLabel(row.pricing) : null;
                          const updated = shortDate(row.lastUpdated);
                          return (
                            <TableRow key={row.pluginId}>
                              <TableCell>
                                <Link
                                  className="pg-row-name"
                                  href={`/flow/plugins/${row.pluginId}`}
                                >
                                  {row.name || row.pluginId}
                                </Link>
                                {updated ? <div className="pg-sub">Updated {updated}</div> : null}
                              </TableCell>
                              <TableCell className="pg-col-vis">
                                {visibilityLabel(row.status)}
                              </TableCell>
                              <TableCell className="pg-col-review">
                                <Badge tone={review.tone}>{review.label}</Badge>
                              </TableCell>
                              <TableCell className="pg-num">{row.downloads ?? 0}</TableCell>
                              <TableCell className={price ? 'pg-num' : 'pg-num pg-muted'}>
                                {price || 'Free'}
                              </TableCell>
                              {anyPaid ? (
                                <TableCell className="pg-num">
                                  {row.isPaid
                                    ? money(row.revenue || 0, row.pricing?.currency || 'usd')
                                    : '—'}
                                </TableCell>
                              ) : null}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="pg-foot">
                    Marketplace plugins are reviewed by Tensr before each version goes live.
                  </p>
                </>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
