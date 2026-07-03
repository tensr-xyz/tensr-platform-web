'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/atoms/button';
import { Checkbox } from '@/components/atoms/checkbox';
import { SPSS_MENU_PATHS, type AnalysisKey } from '@/lib/analysis-definitions';

const STORAGE_KEY = 'tensr_spss_switcher';

export type SpssSwitcherPrefs = {
  enabled: boolean;
  checklist: {
    upload: boolean;
    frequencies: boolean;
    ttest: boolean;
    readOutput: boolean;
  };
  dismissedWalkthrough: boolean;
};

export function getSpssSwitcherPrefs(): SpssSwitcherPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SpssSwitcherPrefs) : null;
  } catch {
    return null;
  }
}

export function setSpssSwitcherPrefs(prefs: SpssSwitcherPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/** Signup / paywall: opt in to SPSS switcher experience */
export function SpssSwitcherSignupOption({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={v => onCheckedChange(v === true)}
        className="mt-0.5"
      />
      <span>
        <span className="font-medium text-foreground">I&apos;m switching from SPSS</span>
        <span className="mt-1 block text-muted-foreground">
          Show SPSS menu paths, sample workflow tips, and a cost comparison at checkout.
        </span>
      </span>
    </label>
  );
}

/** Paywall cost comparison */
export function SpssCostComparison() {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
      <p className="font-medium text-foreground">Switching from SPSS?</p>
      <p className="mt-1 text-muted-foreground">
        Tensr from <span className="font-semibold text-foreground">$9.99/month</span> vs IBM SPSS
        from <span className="font-semibold text-foreground">~£1,200/year</span> — same rigour,
        modern UI, AI built in.
      </p>
    </div>
  );
}

const CHECKLIST_STEPS: {
  key: keyof SpssSwitcherPrefs['checklist'];
  label: string;
  path?: AnalysisKey;
}[] = [
  { key: 'upload', label: 'Upload your data (.sav or CSV)' },
  { key: 'frequencies', label: 'Run Frequencies', path: 'descriptives' },
  { key: 'ttest', label: 'Run Independent-Samples T Test', path: 'ttest_independent' },
  { key: 'readOutput', label: 'Review output (Group Statistics + APA tables)' },
];

export function SpssWorkspaceWalkthrough({ onDismiss }: { onDismiss?: () => void }) {
  const [prefs, setPrefs] = useState<SpssSwitcherPrefs | null>(null);

  useEffect(() => {
    setPrefs(getSpssSwitcherPrefs());
  }, []);

  if (!prefs?.enabled || prefs.dismissedWalkthrough) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-sm font-medium">SPSS switcher checklist</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Use Variable View (Data menu) to set labels. Analyses use the same names as SPSS.
      </p>
      <ul className="mt-3 space-y-2 text-xs">
        {CHECKLIST_STEPS.map(step => (
          <li key={step.key} className="flex items-center gap-2">
            <Checkbox checked={prefs.checklist[step.key]} disabled />
            <span>
              {step.label}
              {step.path ? (
                <span className="block text-[10px] text-muted-foreground">
                  {SPSS_MENU_PATHS[step.path]}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const next = { ...prefs, dismissedWalkthrough: true };
            setSpssSwitcherPrefs(next);
            setPrefs(next);
            onDismiss?.();
          }}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
