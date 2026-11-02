'use client';

import * as React from 'react';

import { Textarea as AtomTextarea } from '@/components/atoms/text-area';
import { cn } from '@/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <AtomTextarea
      ref={ref}
      className={cn(
        'min-h-10 rounded-[10px] border-input text-[14px] focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };
