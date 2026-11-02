import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@/utils';

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'div';
  return (
    <Comp
      ref={ref}
      className={cn('rounded-[14px] border border-border bg-card text-card-foreground', className)}
      {...props}
    />
  );
});
Card.displayName = 'Card';

export { Card };
