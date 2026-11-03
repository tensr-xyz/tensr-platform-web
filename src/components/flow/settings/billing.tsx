'use client';

import { useState } from 'react';
import { flowJson } from '@/lib/flow-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BILLING_RETURN_PATH, ChangePlanDialog } from './change-plan';
import { loadMe, loadPlans, loadSubscription, openBillingPortal } from './billing-load';
import { Bar, RowCard, SettingsError, SkeletonCard } from './parts';
import {
  errorText,
  formatDay,
  formatMoney,
  isLiveStripeSubscription,
  planLabel,
  planPrice,
  trialProgress,
  type Invoice,
} from './settings-data';
import { useLoad } from './use-load';

async function loadBilling() {
  const [me, subscription, catalog, invoices] = await Promise.all([
    loadMe(),
    loadSubscription(),
    loadPlans(),
    flowJson<{ invoices?: Invoice[] }>('/api/billing/invoices')
      .then(page => page.invoices || [])
      .catch(() => null),
  ]);
  return { me, subscription, catalog, invoices };
}

export function SettingsBilling() {
  const { state, retry, reload } = useLoad(loadBilling, []);
  const [planOpen, setPlanOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  if (state.phase === 'loading') {
    return (
      <div className="st-stack st-narrow">
        <SkeletonCard rows={2} />
        <SkeletonCard rows={1} />
        <SkeletonCard rows={3} />
      </div>
    );
  }
  if (state.phase === 'error') return <SettingsError message={state.error} onRetry={retry} />;

  const { me, subscription, catalog, invoices } = state.data;
  const code = me.entitlements?.plan_code || subscription?.tier || 'none';
  const status = (subscription?.status || '').toLowerCase();
  const trial = trialProgress(me.access, me.entitlements?.trial_days);
  const live = isLiveStripeSubscription(subscription);
  const hasCustomer = Boolean(subscription?.stripeCustomerId);
  const cancelScheduled = live && Boolean(subscription?.cancelAtPeriodEnd);
  const endDate = subscription?.cancelAt || subscription?.renewalDate;
  const plan = catalog.plans.find(item => item.code === code);
  const monthly = plan ? planPrice(plan, 'monthly') : null;
  const pro = catalog.plans.find(item => item.code === 'pro');
  const proMonthly = pro ? planPrice(pro, 'monthly') : null;
  const proAnnual = pro ? planPrice(pro, 'annual') : null;

  const portal = async () => {
    setBusy('portal');
    setError('');
    try {
      const opened = await openBillingPortal(BILLING_RETURN_PATH);
      if (!opened) setPlanOpen(true);
    } catch (err) {
      setError(errorText(err, 'Stripe billing did not open.'));
    } finally {
      setBusy('');
    }
  };

  const changeCancel = async (path: 'cancel-subscription' | 'resume-subscription') => {
    setBusy(path);
    setError('');
    try {
      await flowJson(`/api/billing/${path}`, { method: 'POST', body: '{}' });
      setCancelOpen(false);
      await reload();
    } catch (err) {
      setError(errorText(err, 'Your plan was not changed.'));
    } finally {
      setBusy('');
    }
  };

  let title = planLabel(code);
  let badge: { tone: 'warn' | 'active' | 'default'; text: string } | null = null;
  let sub = '';
  if (trial) {
    title = 'Free trial';
    badge = {
      tone: 'warn',
      text: `Trial · ${trial.daysLeft} ${trial.daysLeft === 1 ? 'day' : 'days'} left`,
    };
    sub =
      proMonthly && proAnnual
        ? `Pro is ${formatMoney(proMonthly.amount, catalog.currency)} a month after your trial, or ${formatMoney(proAnnual.amount, catalog.currency)} a month billed annually. No card needed until then.`
        : 'Pick a plan before your trial ends. No card needed until then.';
  } else if (me.access?.reason === 'trial_expired') {
    title = 'Trial ended';
    badge = { tone: 'warn', text: 'Read only' };
    sub = 'Your projects are safe. Pick a plan to keep working on them.';
  } else if (code === 'none' || !subscription || status === 'canceled') {
    title = 'No plan';
    sub = 'Pick a plan to run analyses and use the agent.';
  } else if (cancelScheduled) {
    badge = { tone: 'warn', text: `Ends ${formatDay(endDate)}` };
    sub = `You keep access until ${formatDay(endDate)} and won’t be charged again.`;
  } else {
    badge = { tone: 'active', text: status === 'past_due' ? 'Payment due' : 'Active' };
    const price = monthly ? `${formatMoney(monthly.amount, catalog.currency)} ${monthly.unit}` : '';
    const renew = subscription.renewalDate
      ? `renews on ${formatDay(subscription.renewalDate)}`
      : '';
    sub = [price, renew].filter(Boolean).join(' · ');
  }

  const primary = live ? (
    cancelScheduled ? (
      <Button
        className="st-btn primary"
        type="button"
        disabled={Boolean(busy)}
        onClick={() => changeCancel('resume-subscription')}
      >
        {busy === 'resume-subscription' ? 'Keeping…' : 'Keep my plan'}
      </Button>
    ) : (
      <Button className="st-btn primary" type="button" disabled={Boolean(busy)} onClick={portal}>
        {busy === 'portal' ? 'Opening…' : 'Manage billing'}
      </Button>
    )
  ) : (
    <Button className="st-btn primary" type="button" onClick={() => setPlanOpen(true)}>
      {trial ? 'Add payment method' : 'Choose a plan'}
    </Button>
  );

  return (
    <div className="st-stack st-narrow">
      <section className="st-card st-plan-card">
        <div className="st-plan-card-top">
          <div className="st-plan-card-text">
            <div className="st-plan-card-title">
              <h2>{title}</h2>
              {badge ? <Badge tone={badge.tone}>{badge.text}</Badge> : null}
            </div>
            {sub ? <p className="st-row-sub st-plan-card-sub">{sub}</p> : null}
          </div>
          <div className="st-actions">
            <Button className="st-btn" type="button" onClick={() => setPlanOpen(true)}>
              Change plan
            </Button>
            {primary}
          </div>
        </div>
        {trial ? (
          <div className="st-progress">
            <div className="st-progress-label">
              <span>Trial used</span>
              <strong>
                {trial.used} of {trial.total} days
              </strong>
            </div>
            <Bar percent={trial.percent} />
          </div>
        ) : null}
      </section>

      {error ? <p className="flow-error">{error}</p> : null}

      <RowCard
        title="Payment method"
        sub={
          hasCustomer
            ? 'Your card is kept with Stripe. Change it there.'
            : trial
              ? 'None yet. Your workspace keeps working until the trial ends.'
              : 'None yet. You add a card when you choose a plan.'
        }
        action={
          hasCustomer ? (
            <Button className="st-btn" type="button" disabled={Boolean(busy)} onClick={portal}>
              Update card
            </Button>
          ) : (
            <Button className="st-btn" type="button" onClick={() => setPlanOpen(true)}>
              Add card
            </Button>
          )
        }
      />

      {hasCustomer ? (
        <RowCard
          title="Billing details"
          sub="Company name, VAT number and the invoice email are kept with Stripe."
          action={
            <Button className="st-btn" type="button" disabled={Boolean(busy)} onClick={portal}>
              Edit
            </Button>
          }
        />
      ) : null}

      <section className="st-card st-table-card">
        <header className="st-table-head">
          <h2 className="st-row-title">Invoices</h2>
          <span className="st-row-sub">Sent by email when each one is issued</span>
        </header>
        {invoices && invoices.length ? (
          <Table className="st-table">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead aria-label="Download" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(invoice => (
                <TableRow key={invoice.invoiceId}>
                  <TableCell>{formatDay(invoice.createdAt)}</TableCell>
                  <TableCell>{invoice.description || 'Subscription'}</TableCell>
                  <TableCell>{formatMoney(invoice.amount, invoice.currency)}</TableCell>
                  <TableCell className="st-cap">{invoice.status}</TableCell>
                  <TableCell className="st-right">
                    {invoice.pdfUrl ? (
                      <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                        Download
                      </a>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="st-table-empty">
            {invoices === null
              ? 'Invoices did not load. Open Stripe billing to see them.'
              : trial
                ? `Your first invoice arrives when your plan starts${me.access?.trial_ends_at ? ` after ${formatDay(me.access.trial_ends_at)}` : ''}.`
                : 'No invoices yet.'}
          </p>
        )}
      </section>

      {live && !cancelScheduled ? (
        <RowCard
          title="Cancel plan"
          sub={
            subscription?.renewalDate
              ? `You keep access until ${formatDay(subscription.renewalDate)} and can undo this until then.`
              : 'You keep access until the end of this billing period.'
          }
          action={
            <Button className="st-btn danger" type="button" onClick={() => setCancelOpen(true)}>
              Cancel plan
            </Button>
          }
        />
      ) : null}

      <ChangePlanDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        plans={catalog.plans}
        currency={catalog.currency}
        subscription={subscription}
        currentCode={code}
        trialEndsAt={trial ? me.access?.trial_ends_at : null}
        onChanged={() => void reload()}
      />

      <Dialog open={cancelOpen} onOpenChange={next => (busy ? null : setCancelOpen(next))}>
        <DialogContent className="st-dialog">
          <DialogHeader>
            <DialogTitle>Cancel your plan?</DialogTitle>
            <DialogDescription>
              {subscription?.renewalDate
                ? `Your plan stays on until ${formatDay(subscription.renewalDate)} and you won’t be charged again. You can keep it any time before then.`
                : 'Your plan stays on until the end of this billing period and you won’t be charged again.'}
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="flow-error">{error}</p> : null}
          <DialogFooter className="st-dialog-foot">
            <Button
              className="st-btn"
              type="button"
              disabled={Boolean(busy)}
              onClick={() => setCancelOpen(false)}
            >
              Keep my plan
            </Button>
            <Button
              className="st-btn danger-solid"
              type="button"
              disabled={Boolean(busy)}
              onClick={() => changeCancel('cancel-subscription')}
            >
              {busy === 'cancel-subscription' ? 'Cancelling…' : 'Cancel plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
