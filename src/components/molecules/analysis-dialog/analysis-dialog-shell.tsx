'use client';

import * as React from 'react';
import { ArrowLeft, ArrowRight, FlaskConical, Loader2, X } from 'lucide-react';

import type { AnalysisWizardMeta } from '@/lib/analysis-definitions';
import type { AnalysisWizardTooltip } from '@/lib/analysis-wizard-tooltips';
import { Button } from '@/components/atoms/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/molecules/dialog';
import { cn } from '@/utils';

import { AnalysisInfoPopover } from './analysis-info-popover';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  meta: AnalysisWizardMeta;
  tooltip?: AnalysisWizardTooltip;
  onBack: () => void;
  busy: boolean;
  canRun: boolean;
  runBlockers?: string[];
  serverError: string | null;
  onRun: () => void;
  children: React.ReactNode;
};

export function AnalysisDialogShell({
  open,
  onOpenChange,
  title,
  meta,
  tooltip,
  onBack,
  busy,
  canRun,
  runBlockers = [],
  serverError,
  onRun,
  children,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[200]"
        className={cn(
          'z-[200] flex max-h-[min(92vh,720px)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg',
          '[&>button.absolute]:hidden'
        )}
      >
        <header className="shrink-0 border-b border-border px-6 pb-4 pt-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={onBack}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              All analyses
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-start gap-1">
            <DialogTitle className="text-xl font-medium leading-snug tracking-normal">
              {title}
            </DialogTitle>
            {tooltip ? <AnalysisInfoPopover tooltip={tooltip} /> : null}
          </div>
          <DialogDescription className="mt-1 text-left text-xs leading-relaxed text-muted-foreground">
            {meta.summary}
          </DialogDescription>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {serverError ? (
          <div
            className="shrink-0 border-t border-red-900/20 bg-red-600 px-6 py-2.5 text-sm text-white"
            role="alert"
          >
            {serverError}
          </div>
        ) : null}

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-background px-6 py-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span>250-row preview</span>
            </div>
            {!canRun && !busy && runBlockers.length > 0 && !serverError ? (
              <p className="text-[11px] leading-snug text-red-600 dark:text-red-400" role="status">
                {runBlockers[0]}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            onClick={onRun}
            disabled={!canRun || busy}
            className={cn('gap-1.5', (!canRun || busy) && 'opacity-40')}
          >
            {busy ? (
              <>
                Running…
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              </>
            ) : (
              <>
                Run analysis
                <ArrowRight className="h-4 w-4" aria-hidden />
              </>
            )}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
