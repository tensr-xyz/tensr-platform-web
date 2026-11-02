'use client';

import * as React from 'react';

import { Input as AtomInput, type InputProps } from '@/components/atoms/input';
import { cn } from '@/utils';

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <AtomInput
    ref={ref}
    inputSize="sm"
    className={cn(
      'h-9 rounded-[8px] border-input bg-background px-3 text-[13px] focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input, type InputProps };
