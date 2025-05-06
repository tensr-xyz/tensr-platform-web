import * as React from 'react';
import { cn } from '@/utils';
import { Check } from 'lucide-react';

const Progress = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('w-64', className)} {...props} />
);
Progress.displayName = 'Progress';

const ProgressSteps = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('', className)} {...props} />
);
ProgressSteps.displayName = 'ProgressSteps';

interface ProgressStepProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  completed?: boolean;
  isLast?: boolean;
}

const ProgressStep = React.forwardRef<HTMLDivElement, ProgressStepProps>(
  ({ className, active, completed, isLast, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-start relative pb-8', isLast && 'pb-0', className)}
      {...props}
    >
      <div className="absolute left-0 top-0 flex items-center justify-center w-3 h-full">
        {!isLast && (
          <div
            className={cn(
              'absolute top-0 left-1/2 transform -translate-x-1/2 h-full w-[2px]',
              completed ? 'bg-black' : 'bg-gray-300'
            )}
          />
        )}
        <div
          className={cn(
            'absolute top-0 left-1/2 transform -translate-x-1/2 rounded-full z-10',
            completed ? 'bg-black w-3 h-3' : active ? 'bg-black w-3 h-3' : 'bg-gray-300 w-2 h-2'
          )}
        >
          {completed && (
            <Check
              size={10}
              className="text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            />
          )}
        </div>
      </div>
      <div className="ml-6 flex flex-col -mt-[5px]">{props.children}</div>
    </div>
  )
);

ProgressStep.displayName = 'ProgressStep';

const ProgressStepTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm font-medium text-gray-900', className)} {...props} />
  )
);
ProgressStepTitle.displayName = 'ProgressStepTitle';

const ProgressStepDuration = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-xs text-gray-500', className)} {...props} />
  )
);
ProgressStepDuration.displayName = 'ProgressStepDuration';

export { Progress, ProgressSteps, ProgressStep, ProgressStepTitle, ProgressStepDuration };
