'use client';

import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { AnalysisKey } from '@/lib/analysis-definitions';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';

export function createAnalysisLauncher(
  initialOp: AnalysisKey,
  initialBody?: Record<string, unknown> | null
) {
  return function AnalysisLauncher({ children }: { children: ReactNode }) {
    const openSetup = useAnalysisSetupStore(s => s.openSetup);

    const trigger = Children.only(children);
    const triggerEl = isValidElement(trigger)
      ? cloneElement(trigger as ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, {
          onClick: (e: React.MouseEvent) => {
            (trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
            if (!e.defaultPrevented) openSetup(initialOp, initialBody ?? null);
          },
        })
      : children;

    return <>{triggerEl}</>;
  };
}

/** Menu items that map to analyses not yet on tensr-api. */
export function AnalysisUnavailable({
  children,
  featureName,
}: {
  children: ReactNode;
  featureName: string;
}) {
  const openUnavailable = useAnalysisSetupStore(s => s.openUnavailable);

  const trigger = Children.only(children);
  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, {
        onClick: (e: React.MouseEvent) => {
          (trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
          if (!e.defaultPrevented) openUnavailable(featureName);
        },
      })
    : children;

  return <>{triggerEl}</>;
}
