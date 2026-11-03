'use client';

import { useState } from 'react';
import { flowJson } from '@/lib/flow-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';
import {
  errorText,
  formatDay,
  formatMoney,
  PAID_PLANS,
  planBlurb,
  planChoice,
  planFeatures,
  planPrice,
  type ApiPlan,
  type BillingInterval,
  type LegacySubscription,
} from './settings-data';

export const BILLING_RETURN_PATH = '/flow/settings/billing';

/** 7c. Pick Pro, Pro+ or Teams. Paying goes through Stripe checkout; a live plan changes in place. */
export function ChangePlanDialog({
  open,
  onOpenChange,
  plans,
  currency,
  subscription,
  currentCode,
  trialEndsAt,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: ApiPlan[];
  currency: string;
  subscription: LegacySubscription | null;
  currentCode?: string;
  trialEndsAt?: string | null;
  onChanged: () => void;
}) {
  const [interval, setBilling] = useState<BillingInterval>('annual');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const shown = PAID_PLANS.map(code => plans.find(plan => plan.code === code)).filter(
    (plan): plan is ApiPlan => Boolean(plan)
  );

  const choose = async (plan: ApiPlan) => {
    const how = planChoice(subscription, currentCode, plan, plans);
    if (how === 'current') return;
    setBusy(plan.code);
    setError('');
    try {
      if (how === 'update') {
        await flowJson('/api/billing/update-subscription', {
          method: 'POST',
          body: JSON.stringify({ plan_code: plan.code, billingType: interval }),
        });
        onOpenChange(false);
        onChanged();
        return;
      }
      const page = await flowJson<{ checkout_url?: string | null; mode?: string }>(
        '/api/billing/checkout-session',
        {
          method: 'POST',
          body: JSON.stringify({
            plan_code: plan.code,
            billing_interval: interval,
            currency: currency.toLowerCase() === 'usd' ? 'usd' : 'gbp',
            ...(plan.per_seat ? { seats: 3 } : {}),
            return_to: BILLING_RETURN_PATH,
          }),
        }
      );
      if (page.checkout_url) {
        window.location.assign(page.checkout_url);
        return;
      }
      onOpenChange(false);
      onChanged();
    } catch (err) {
      setError(errorText(err, 'That plan could not be started.'));
    } finally {
      setBusy(null);
    }
  };

  const trialLine = trialEndsAt
    ? ` Your trial runs until ${formatDay(trialEndsAt)} and you’re charged then.`
    : '';

  return (
    <Dialog open={open} onOpenChange={next => (busy ? null : onOpenChange(next))}>
      <DialogContent className="st-plan-dialog max-w-[880px] gap-0 p-0">
        <div className="st-plan-head">
          <div>
            <DialogTitle className="st-plan-title">Choose a plan</DialogTitle>
            <DialogDescription className="st-plan-sub">
              Every plan gets weighted tables, banner books, sig testing and the agent. They differ
              in how much you use the agent.
            </DialogDescription>
          </div>
          <Segmented
            className="st-seg"
            aria-label="Billing period"
            value={interval}
            onValueChange={setBilling}
            options={[
              { value: 'monthly', label: 'Monthly' },
              {
                value: 'annual',
                label: (
                  <>
                    Annual <span className="st-seg-save">save 20%</span>
                  </>
                ),
              },
            ]}
          />
        </div>
        <div className="st-plan-grid">
          {shown.map(plan => {
            const price = planPrice(plan, interval);
            const how = planChoice(subscription, currentCode, plan, plans);
            const recommended = plan.code === 'pro_plus';
            return (
              <div key={plan.code} className="st-plan" data-recommended={recommended || undefined}>
                <div className="st-plan-name-row">
                  <div>
                    <p className="st-plan-name">{plan.name}</p>
                    <p className="st-plan-blurb">{planBlurb(plan.code)}</p>
                  </div>
                  {how === 'current' ? (
                    <Badge tone="default">Your plan</Badge>
                  ) : recommended ? (
                    <Badge tone="active">Recommended</Badge>
                  ) : null}
                </div>
                {price ? (
                  <p className="st-plan-price">
                    {formatMoney(price.amount, currency)} <span>{price.unit}</span>
                  </p>
                ) : null}
                <ul className="st-plan-features">
                  {planFeatures(plan).map(line => (
                    <li key={line}>✓ {line}</li>
                  ))}
                </ul>
                <Button
                  className={
                    recommended && how !== 'current'
                      ? 'st-btn primary st-plan-cta'
                      : 'st-btn st-plan-cta'
                  }
                  type="button"
                  disabled={how === 'current' || Boolean(busy)}
                  onClick={() => choose(plan)}
                >
                  {how === 'current'
                    ? 'Current plan'
                    : busy === plan.code
                      ? 'Opening…'
                      : `Choose ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>
        {error ? <p className="flow-error st-plan-error">{error}</p> : null}
        <div className="st-plan-foot">
          <p>
            {interval === 'annual' ? 'Billed annually.' : 'Billed monthly.'}
            {trialLine} Card details are taken by Stripe. Agencies and enterprise: help@tensr.xyz
          </p>
          <Button
            className="st-link"
            type="button"
            disabled={Boolean(busy)}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
