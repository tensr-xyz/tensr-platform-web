'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/utils';

// Dynamically import xterm to avoid SSR issues
// @ts-ignore - Dynamic import type resolution issue
const TerminalComponent = dynamic(() => import('./terminal-component'), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-background flex items-center justify-center">
      <div className="text-sm text-muted-foreground">Loading terminal...</div>
    </div>
  ),
}) as React.ComponentType<{ onCommand?: (command: string) => void }>;

interface TerminalProps {
  className?: string;
  onCommand?: (command: string) => void;
}

const Terminal: React.FC<TerminalProps> = ({ className, onCommand }) => {
  return (
    <div className={cn('h-full bg-background', className)}>
      <TerminalComponent onCommand={onCommand} />
    </div>
  );
};

export default Terminal;
