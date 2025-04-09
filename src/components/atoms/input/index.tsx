import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils';

const inputVariants = cva(
  'flex w-full text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border border-input bg-background px-3 py-2',
        ghost:
          'border-none bg-transparent px-2 py-1 focus:bg-background focus-visible:ring-0 focus-visible:ring-offset-0',
        outline: 'border border-input bg-transparent px-3 py-2 hover:border-accent',
      },
      inputSize: {
        // Changed from 'size' to 'inputSize'
        default: 'h-10',
        sm: 'h-8',
        lg: 'h-12',
        cell: 'h-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'default', // Updated default variant
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>, // Omit the HTML size attribute
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, ...props }, ref) => {
    // Changed from 'size' to 'inputSize'
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize, className }))} // Updated to use inputSize
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input, inputVariants };
