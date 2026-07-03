import { cn } from '@/utils';

export function FormSectionLabel({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'text-[10px] font-semibold uppercase tracking-wide text-muted-foreground',
        className
      )}
    >
      {children}
    </p>
  );
}
