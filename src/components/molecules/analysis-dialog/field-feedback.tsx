import { AlertTriangle } from 'lucide-react';

import type { WizardFieldNotice } from '@/lib/analysis-setup-validation';
import { cn } from '@/utils';

export function FieldWarning({ notice }: { notice: WizardFieldNotice }) {
  return (
    <div
      className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-950 dark:text-amber-100"
      role="status"
    >
      <AlertTriangle
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300"
        aria-hidden
      />
      <div>
        <p>{notice.message}</p>
        {notice.remedy ? (
          <p className="mt-0.5 text-amber-800/90 dark:text-amber-200/90">{notice.remedy}</p>
        ) : null}
      </div>
    </div>
  );
}

export function FieldError({ message }: { message: string }) {
  return (
    <p className="text-[11px] leading-snug text-red-600 dark:text-red-400" role="alert">
      {message}
    </p>
  );
}

export function FieldFeedbackList({
  notices = [],
  errors = [],
  className,
}: {
  notices?: WizardFieldNotice[];
  errors?: string[];
  className?: string;
}) {
  if (!notices.length && !errors.length) return null;
  return (
    <div className={cn('space-y-1.5', className)}>
      {notices.length ? (
        <div
          className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-950 dark:text-amber-100"
          role="status"
        >
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300"
            aria-hidden
          />
          <div className="space-y-2">
            {notices.map((n, i) => (
              <div key={`w-${i}`}>
                <p>{n.message}</p>
                {n.remedy ? (
                  <p className="mt-0.5 text-amber-800/90 dark:text-amber-200/90">{n.remedy}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {errors.map((e, i) => (
        <FieldError key={`e-${i}`} message={e} />
      ))}
    </div>
  );
}
