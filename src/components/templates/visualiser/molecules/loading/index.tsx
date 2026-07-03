import { LoaderCircle } from 'lucide-react';

import { cn } from '@/utils';

interface LoaderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

const Loader: React.FC<LoaderProps> = ({ className, size = 'md', fullScreen = false }) => {
  const _sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-18 w-18',
    lg: 'h-24 w-24',
  };

  const spinner = (
    <LoaderCircle
      size={size === 'sm' ? 32 : size === 'md' ? 72 : 96}
      strokeWidth={1}
      className={cn('animate-spin stroke-primary', className)}
    />
  );

  if (fullScreen) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export { Loader };

// Keep default export for backward compatibility
export default Loader;
