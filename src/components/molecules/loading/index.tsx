import { LoaderCircle } from 'lucide-react';

import { cn } from '@/utils';

interface LoaderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  /** Optional status text shown under the spinner (fullScreen only). */
  message?: string;
}

const Loader: React.FC<LoaderProps> = ({ className, size = 'md', fullScreen = false, message }) => {
  const spinner = (
    <LoaderCircle
      size={size === 'sm' ? 32 : size === 'md' ? 72 : 96}
      strokeWidth={1}
      className={cn('animate-spin stroke-primary', className)}
    />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex min-h-dvh w-full flex-col items-center justify-center gap-3 bg-background">
        {spinner}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    );
  }

  return spinner;
};

export { Loader };

// Keep default export for backward compatibility
export default Loader;
