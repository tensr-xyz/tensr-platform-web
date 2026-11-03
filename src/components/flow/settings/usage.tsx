'use client';

import { useState } from 'react';
import { flowJson } from '@/lib/flow-api';
import { Button } from '@/components/ui/button';
import { ChangePlanDialog } from './change-plan';
import { loadMe, loadPlans, loadSubscription } from './billing-load';
import { Bar, SettingsError } from './parts';
import { Skeleton } from '@/components/ui/rest';
import {
  compactCount,
  formatDay,
  meter,
  trialProgress,
  usageNudge,
  type Meter,
} from './settings-data';
import { useLoad } from './use-load';

type UsagePage = {
  summary?: { analyses?: number; reports?: number };
  usage?: { reports?: number; aiRequests?: number };
  limits?: { assistant_requests?: number; reports?: number };
  currentUsage?: number;
};

type DatasetRow = { n_rows?: number };

async function loadUsage() {
  const [me, usage, datasets, subscription, catalog] = await Promise.all([
    loadMe(),
    flowJson<UsagePage>('/api/billing/usage'),
    flowJson<DatasetRow[] | { datasets?: DatasetRow[] }>('/datasets/?scope=all').then(page =>
      Array.isArray(page) ? page : page.datasets || []
    ),
    loadSubscription().catch(() => null),
    loadPlans(),
  ]);
  return { me, usage, datasets, subscription, catalog };
}

export function SettingsUsage() {
  const { state, retry, reload } = useLoad(loadUsage, []);
  const [planOpen, setPlanOpen] = useState(false);

  if (state.phase === 'loading') {
    return (
      <div className="st-stack st-wide" aria-busy="true">
        <Skeleton className="h-5 w-72" />
        <div className="st-meters">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="st-card st-meter">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-1 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (state.phase === 'error') return <SettingsError message={state.error} onRetry={retry} />;

  const { me, usage, datasets, subscription, catalog } = state.data;
  const ent = me.entitlements || {};
  const trial = trialProgress(me.access, ent.trial_days);
  const runs = usage.usage?.aiRequests ?? usage.currentUsage ?? 0;
  const reports = usage.usage?.reports ?? usage.summary?.reports ?? 0;
  const largest = datasets.reduce((max, row) => Math.max(max, row.n_rows || 0), 0);
  const meters: Meter[] = [
    meter('Agent runs', runs, usage.limits?.assistant_requests ?? ent.assistant_limit_monthly ?? 0),
    meter('AI reports', reports, usage.limits?.reports ?? ent.report_limit_monthly ?? 0),
    meter('Datasets', datasets.length, ent.max_datasets ?? 0),
    meter('Largest file', largest, ent.max_rows_per_dataset ?? 0, 'rows'),
  ];
  const nudge = usageNudge(meters, Boolean(trial));
  const caption = trial
    ? `Trial allowance · ends on ${formatDay(me.access?.trial_ends_at)}`
    : subscription?.renewalDate
      ? `This month · resets on ${formatDay(subscription.renewalDate)}`
      : 'This month';

  return (
    <div className="st-stack st-wide">
      <p className="st-caption">{caption}</p>
      <div className="st-meters">
        {meters.map(item => (
          <div key={item.label} className="st-card st-meter">
            <p className="st-meter-label">{item.label}</p>
            <p className="st-meter-figure">
              {item.unit ? compactCount(item.used) : item.used.toLocaleString('en-GB')}{' '}
              <span>
                {item.cap > 0
                  ? `/ ${item.unit ? `${compactCount(item.cap)} ${item.unit}` : item.cap.toLocaleString('en-GB')}`
                  : item.unit
                    ? item.unit
                    : 'no limit'}
              </span>
            </p>
            <Bar percent={item.cap > 0 ? item.percent : 0} warn={item.warn} />
          </div>
        ))}
      </div>
      {nudge ? (
        <div className="st-nudge">
          <p>{nudge}</p>
          <Button className="st-btn primary" type="button" onClick={() => setPlanOpen(true)}>
            Choose a plan
          </Button>
        </div>
      ) : null}
      <p className="st-note">
        Agent runs and AI reports count this billing month. Datasets and file size are what your
        workspace holds now.
      </p>
      <ChangePlanDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        plans={catalog.plans}
        currency={catalog.currency}
        subscription={subscription}
        currentCode={ent.plan_code}
        trialEndsAt={trial ? me.access?.trial_ends_at : null}
        onChanged={() => void reload()}
      />
    </div>
  );
}
