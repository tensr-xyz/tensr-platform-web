import { cn } from '@/utils';
import { LoaderCircle } from 'lucide-react';

interface LoadingProps {
  className?: string;
}

export default function Loading(props: LoadingProps) {
  const { className } = props;

  return (
    <div className="h-screen w-full flex items-center justify-center bg-transparent">
      <LoaderCircle size={36} className={cn('animate-spin text-primary', className)} />
    </div>
  );
}
