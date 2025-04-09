import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { X } from 'lucide-react';

import { cn } from '@/utils';

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Root ref={ref} className={cn('flex h-full flex-col', className)} {...props} />
));
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('flex h-10 items-center border-b border-border', className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    onClose?: () => void;
    isClosable?: boolean;
  }
>(({ className, children, onClose, isClosable = true, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'group relative flex h-10 select-none items-center gap-2 text-xs font-medium px-2',
      'transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'border-b data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-font',
      'data-[state=inactive]:border-transparent data-[state=inactive]:bg-foreground',
      className
    )}
    {...props}
  >
    {children}
    {isClosable && (
      <button
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          onClose?.();
        }}
        className={cn(
          'rounded-sm p-0.5 hover:bg-gray-200',
          'transition-opacity focus:outline-none focus:ring-2 focus:ring-ring',
          'opacity-0 group-data-[state=active]:opacity-100 group-hover:opacity-100'
        )}
        aria-label="Close tab"
      >
        <X className="h-3 w-3" />
      </button>
    )}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'flex-1 overflow-hidden',
      'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
