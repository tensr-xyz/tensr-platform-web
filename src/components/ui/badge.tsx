import { Badge as AtomBadge, type BadgeProps } from '@/components/atoms/badge';
import { cn } from '@/utils';

const tones = {
  default: 'rounded-[6px] border-transparent bg-secondary text-foreground',
  active: 'rounded-[6px] border-transparent bg-accent text-accent-foreground',
  draft: 'rounded-[6px] border-border bg-transparent text-foreground',
  soon: 'rounded-[6px] border-border bg-background text-muted-foreground font-normal',
  warn: 'rounded-[6px] border-transparent bg-[#F6EDE2] text-warn',
  ink: 'rounded-[6px] border-transparent bg-foreground text-background',
} as const;

export type BadgeTone = keyof typeof tones;

function Badge({ className, tone = 'default', ...props }: BadgeProps & { tone?: BadgeTone }) {
  return (
    <AtomBadge
      variant="outline"
      className={cn('h-auto px-2 py-0.5 text-[12px] font-medium', tones[tone], className)}
      {...props}
    />
  );
}

export { Badge };
