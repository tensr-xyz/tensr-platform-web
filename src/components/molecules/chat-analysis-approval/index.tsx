'use client';

import { Button } from '@/components/atoms/button';
import { Loader2, Settings2, Play, X, Check } from 'lucide-react';
import { cn } from '@/utils';
import type { ChatPendingAction } from '@/lib/chat-pending-action';
import { formatPlanVariablesLine } from '@/lib/chat-pending-action';
import { ANALYSIS_LABELS } from '@/lib/analysis-definitions';
import { analysisLabelForPlan } from '@/lib/agent-analysis-progress';

type Props = {
  action: ChatPendingAction;
  className?: string;
  isStale?: boolean;
  onSkip: () => void;
  onAccept: () => void;
  onManage: () => void;
  disabled?: boolean;
};

function actionTitle(action: ChatPendingAction): string {
  if (action.kind === 'analysis_plan') {
    return analysisLabelForPlan(action.plan);
  }
  if (action.kind === 'data_action') {
    const t = action.action.actionType.replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return action.menuName;
}

function actionSubtitle(action: ChatPendingAction): string | null {
  if (action.kind === 'analysis_plan') {
    const line = formatPlanVariablesLine(action.plan);
    return line || null;
  }
  if (action.kind === 'data_action') {
    return action.action.rationale?.slice(0, 120) || 'Apply to spreadsheet';
  }
  return ANALYSIS_LABELS[action.op] ?? null;
}

function acceptLabel(status: ChatPendingAction['status']): string {
  if (status === 'planning') return 'Planning…';
  if (status === 'running') return 'Running…';
  if (status === 'failed') return 'Retry';
  return 'Accept';
}

export function ChatAnalysisApproval({
  action,
  className,
  isStale = false,
  onSkip,
  onAccept,
  onManage,
  disabled = false,
}: Props) {
  if (action.status === 'skipped') {
    return null;
  }

  const title = actionTitle(action);

  if (action.status === 'expired' || isStale) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border/80 bg-muted/20 px-3 py-2 opacity-70',
          className
        )}
      >
        <p className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/80">{title}</span> — suggestion expired. Use
          the latest message below or ask again.
        </p>
      </div>
    );
  }

  if (action.status === 'running') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2',
          className
        )}
      >
        <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-[11px] text-muted-foreground">
          Running <span className="font-medium text-foreground/80">{title}</span>…
        </p>
      </div>
    );
  }

  if (action.status === 'accepted') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5',
          className
        )}
      >
        <Check className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/70">{title}</span> — complete
        </p>
      </div>
    );
  }

  const isPlanning = action.status === 'planning';
  const isBusy = isPlanning;
  const isFailed = action.status === 'failed';
  const subtitle = actionSubtitle(action);
  const buttonsLocked = disabled || isBusy;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-muted/40',
        isBusy && 'opacity-90',
        isFailed && 'border-destructive/40',
        className
      )}
    >
      <div className="border-b border-border/80 px-3 py-2">
        <p className="text-[11px] font-medium text-foreground">
          {action.kind === 'data_action' ? 'Apply to spreadsheet' : 'Run analysis'}
        </p>
        <p className="mt-0.5 text-[12px] text-foreground">
          <span className="font-medium">{title}</span>
          {subtitle ? <span className="text-muted-foreground"> · {subtitle}</span> : null}
        </p>
        {action.kind === 'analysis_plan' && action.plan.rationale ? (
          <p className="mt-1.5 line-clamp-4 text-[11px] leading-snug text-muted-foreground">
            {action.plan.rationale}
          </p>
        ) : null}
        {isFailed && action.errorMessage ? (
          <p className="mt-2 text-[11px] leading-snug text-destructive">{action.errorMessage}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
          onClick={onSkip}
          disabled={buttonsLocked}
        >
          <X className="size-3" aria-hidden />
          Skip
        </Button>
        {action.kind !== 'data_action' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={onManage}
            disabled={buttonsLocked}
          >
            <Settings2 className="size-3" aria-hidden />
            Manage
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="ml-auto h-7 gap-1 px-2.5 text-[11px]"
          onClick={onAccept}
          disabled={buttonsLocked}
        >
          {isBusy ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <Play className="size-3" aria-hidden />
          )}
          {action.kind === 'data_action' && action.status === 'pending'
            ? 'Apply'
            : acceptLabel(action.status)}
        </Button>
      </div>
    </div>
  );
}
