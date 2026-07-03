'use client';

import { Info } from 'lucide-react';

import type { AnalysisWizardTooltip } from '@/lib/analysis-wizard-tooltips';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import { Button } from '@/components/atoms/button';

function TooltipSection({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <div>
      <p className="font-semibold text-foreground">{title}</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">
        {bullets.map(line => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export function AnalysisInfoPopover({ tooltip }: { tooltip: AnalysisWizardTooltip }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Analysis information"
        >
          <Info className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[260] max-h-[min(70vh,420px)] w-80 space-y-3 overflow-y-auto p-3 text-xs"
        sideOffset={6}
      >
        <TooltipSection title="When to use" bullets={tooltip.useWhen} />
        <TooltipSection title="Assumptions" bullets={tooltip.assumptions} />
        <TooltipSection title="Output" bullets={tooltip.output} />
      </PopoverContent>
    </Popover>
  );
}
