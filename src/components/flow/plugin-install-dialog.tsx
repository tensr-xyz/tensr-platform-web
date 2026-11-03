'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { flowJson } from '@/lib/flow-api';
import {
  apiErrorText,
  initialOf,
  money,
  permissionSummary,
  priceLabel,
  type PluginRecord,
} from './plugin-pages';
import './plugins-pages.css';

type PurchaseResponse = {
  status?: 'completed' | 'requires_checkout' | string;
  checkout_url?: string;
};

export function PluginInstallDialog({
  plugin,
  open,
  onOpenChange,
  onInstalled,
}: {
  plugin: PluginRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstalled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricing = plugin.isPaid ? plugin.pricing : null;
  const price = priceLabel(pricing);
  const trialDays = pricing?.model === 'subscription' ? pricing.trialDays || 0 : 0;
  const summary = permissionSummary(plugin.capabilities);
  const id = encodeURIComponent(plugin.pluginId);

  const install = () => {
    setBusy(true);
    setError(null);
    const installNow = () => flowJson(`/plugins/${id}/install`, { method: 'POST' });
    const run = plugin.isPaid
      ? flowJson<PurchaseResponse>(`/plugins/${id}/purchase`, {
          method: 'POST',
          body: JSON.stringify({ returnTo: `/flow/plugins/${plugin.pluginId}` }),
        }).then(result => {
          if (result.status === 'requires_checkout' && result.checkout_url) {
            window.location.assign(result.checkout_url);
            return 'redirect' as const;
          }
          return installNow().then(() => 'done' as const);
        })
      : installNow().then(() => 'done' as const);
    void run
      .then(outcome => {
        // On redirect, stay busy until the browser leaves for checkout.
        if (outcome === 'done') {
          setBusy(false);
          onInstalled();
        }
      })
      .catch(reason => {
        setError(apiErrorText(reason, 'Could not install this plugin.'));
        setBusy(false);
      });
  };

  const actionLabel = busy
    ? plugin.isPaid
      ? 'Opening checkout'
      : 'Installing'
    : plugin.isPaid
      ? trialDays > 0
        ? 'Start free trial'
        : 'Continue to payment'
      : 'Install';

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (busy) return;
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="pg-dialog">
        <DialogHeader className="pg-dialog-head">
          <div className="pg-tile small" aria-hidden="true">
            {initialOf(plugin.name)}
          </div>
          <div className="pg-dialog-titles">
            <DialogTitle className="pg-dialog-title font-medium">Install {plugin.name}</DialogTitle>
            <DialogDescription className="pg-muted">
              {plugin.authorName ? `by ${plugin.authorName}` : 'Tensr plugin'}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="pg-dialog-body">
          {price && pricing?.price ? (
            <div className="pg-box pg-price">
              <div className="pg-row">
                <span>
                  {pricing.model === 'subscription'
                    ? `${pricing.subscriptionInterval === 'yearly' ? 'Yearly' : 'Monthly'} subscription`
                    : 'One-off payment'}
                </span>
                <span>{price}</span>
              </div>
              <div className="pg-rule" />
              <div className="pg-row pg-strong">
                <span>
                  {trialDays > 0 ? `Due after the ${trialDays}-day free trial` : 'Due today'}
                </span>
                <span>{money(pricing.price, pricing.currency)}</span>
              </div>
            </div>
          ) : null}
          {plugin.isPaid ? (
            <p className="pg-small pg-muted">
              You&apos;ll pay on a secure Stripe page, then come back here to finish installing.
            </p>
          ) : null}
          {summary ? (
            <div className="pg-well">
              <div className="pg-small pg-strong">It will be able to</div>
              <div className="pg-small pg-muted">{summary}</div>
            </div>
          ) : null}
          {error ? <p className="flow-error">{error}</p> : null}
        </div>

        <div className="pg-dialog-foot">
          <Button
            className="flow-btn pg-btn"
            type="button"
            disabled={busy}
            onClick={() => {
              setError(null);
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            className="flow-btn primary pg-btn"
            type="button"
            disabled={busy}
            onClick={install}
          >
            {actionLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
