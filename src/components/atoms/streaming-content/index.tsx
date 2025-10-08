import { Suspense } from 'react';
import { Loading } from '@/components/molecules/loading';

interface StreamingContentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export function StreamingContent({
  children,
  fallback = <Loading />,
  className = '',
}: StreamingContentProps) {
  return (
    <Suspense fallback={fallback}>
      <div className={className}>{children}</div>
    </Suspense>
  );
}

// Specialized streaming components for different content types
export function StreamingFiles({ children }: { children: React.ReactNode }) {
  return (
    <StreamingContent fallback={<div className="p-4">Loading files...</div>}>
      {children}
    </StreamingContent>
  );
}

export function StreamingProjects({ children }: { children: React.ReactNode }) {
  return (
    <StreamingContent fallback={<div className="p-4">Loading projects...</div>}>
      {children}
    </StreamingContent>
  );
}

export function StreamingUser({ children }: { children: React.ReactNode }) {
  return (
    <StreamingContent fallback={<div className="p-4">Loading user data...</div>}>
      {children}
    </StreamingContent>
  );
}
