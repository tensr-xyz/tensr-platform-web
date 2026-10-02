'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Gift } from 'lucide-react';
import posthog from 'posthog-js';

import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import {
  REFERRAL_STATUS_LABEL,
  type ReferralPanelData,
  type ReferralRowStatus,
  fetchReferralPanel,
  monthsLabel,
  referralLink,
} from '@/lib/referral';

type PanelDeps = {
  loadPanel?: () => Promise<ReferralPanelData>;
  copyText?: (text: string) => Promise<void>;
  origin?: string;
};

const STATUS_VARIANT: Record<
  ReferralRowStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  signed_up: 'outline',
  trialling: 'secondary',
  paid: 'secondary',
  reward_granted: 'default',
  reversed: 'destructive',
  not_eligible: 'outline',
};

function defaultCopy(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

function RewardCopy({ reward }: { reward: ReferralPanelData['reward'] }) {
  const same = reward.referrer_months === reward.referee_months;
  const headline = same
    ? `You both get ${monthsLabel(reward.referrer_months)} free`
    : `You get ${monthsLabel(reward.referrer_months)} free, they get ${monthsLabel(reward.referee_months)} free`;
  return (
    <p className="text-xs text-muted-foreground">
      {headline} once they make their first payment. Credit applies to your next invoice. Refunds
      within {reward.reversal_window_days} days reverse it. Up to {monthsLabel(reward.cap_months)} a
      year
      {reward.excluded_plans.length
        ? `; ${reward.excluded_plans.join(', ')} plans are excluded`
        : ''}
      .
    </p>
  );
}

function ReferredByNote({
  referredBy,
}: {
  referredBy: NonNullable<ReferralPanelData['referred_by']>;
}) {
  const granted = referredBy.reward_status === 'granted';
  return (
    <p className="rounded-md bg-muted/50 px-3 py-2 text-xs" data-testid="referral-referred-by">
      {granted
        ? `Your reward: ${monthsLabel(referredBy.reward_months)} free, credited to your next invoice.`
        : 'You joined through a referral. Your free month is credited after your first payment.'}
    </p>
  );
}

export function ReferralPanelBody({
  loadPanel = fetchReferralPanel,
  copyText = defaultCopy,
  origin,
}: PanelDeps) {
  const [data, setData] = useState<ReferralPanelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPanel()
      .then(next => {
        if (!cancelled) setData(next);
      })
      .catch(err => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Referral details are unavailable.');
      });
    return () => {
      cancelled = true;
    };
  }, [loadPanel]);

  const link = data ? referralLink(data, origin ?? window.location.origin) : '';

  const handleCopy = useCallback(async () => {
    if (!link) return;
    try {
      await copyText(link);
      setCopied(true);
      posthog.capture('referral_link_copied', { surface: 'header_panel' });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Select the link and copy it manually.');
    }
  }, [copyText, link]);

  if (error && !data) return <p className="px-3 py-4 text-sm text-muted-foreground">{error}</p>;
  if (!data) return <p className="px-3 py-4 text-sm text-muted-foreground">Loading…</p>;
  if (!data.enabled) {
    return (
      <p className="px-3 py-4 text-sm text-muted-foreground">Referrals are paused right now.</p>
    );
  }

  return (
    <div className="space-y-3 px-3 py-3">
      <RewardCopy reward={data.reward} />
      {data.referred_by ? <ReferredByNote referredBy={data.referred_by} /> : null}
      <div className="flex items-center gap-2">
        <input
          readOnly
          aria-label="Your referral link"
          value={link}
          onFocus={event => event.currentTarget.select()}
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 font-mono text-xs"
        />
        <Button type="button" size="sm" onClick={handleCopy} aria-label="Copy referral link">
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div>
        <p className="mb-1 text-xs font-medium text-foreground">
          Your referrals{data.months_earned ? ` · ${monthsLabel(data.months_earned)} earned` : ''}
        </p>
        {data.referrals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No referrals yet.</p>
        ) : (
          <ul className="max-h-48 divide-y divide-border overflow-y-auto" aria-label="Referrals">
            {data.referrals.map(row => (
              <li key={row.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                <span className="truncate">{row.referee}</span>
                <Badge variant={STATUS_VARIANT[row.status]}>
                  {REFERRAL_STATUS_LABEL[row.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ReferButton(props: PanelDeps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-10 gap-1.5 rounded-full border border-border px-3"
        >
          <Gift className="h-[15px] w-[15px]" aria-hidden />
          <span className="text-sm">Refer</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0" sideOffset={8}>
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-medium text-foreground">Refer a colleague</p>
        </div>
        {open ? <ReferralPanelBody {...props} /> : null}
      </PopoverContent>
    </Popover>
  );
}
