'use client';

import * as React from 'react';

import { Button as AtomButton, type ButtonProps } from '@/components/atoms/button';
import { cn } from '@/utils';

/** Paper-sized button. Screens pass variant and className; sizes stay here. */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <AtomButton
      ref={ref}
      variant={variant ?? 'unstyled'}
      size={size ?? 'compact'}
      className={cn(
        'rounded-[8px] focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0',
        className
      )}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export { Button, type ButtonProps };
