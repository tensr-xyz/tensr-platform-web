import type { ColumnSlotType } from '@/lib/analysis-column-types';
import {
  SLOT_BADGE_CLASS,
  SLOT_BADGE_MISMATCH_CLASS,
  slotTypeLabel,
} from '@/lib/analysis-column-types';
import { cn } from '@/utils';

export function SlotTypeBadge({
  slot,
  mismatch = false,
  className,
}: {
  slot: ColumnSlotType;
  mismatch?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium capitalize leading-none',
        mismatch ? SLOT_BADGE_MISMATCH_CLASS : SLOT_BADGE_CLASS[slot],
        className
      )}
    >
      {slotTypeLabel(slot)}
    </span>
  );
}
