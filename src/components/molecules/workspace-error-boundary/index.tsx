'use client';

import React, { Component, type ReactNode } from 'react';
import { Button } from '@/components/atoms/button';

type Props = {
  children: ReactNode;
  title?: string;
};

type State = {
  error: Error | null;
};

export class WorkspaceErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-4 px-6 text-center">
          <h2 className="text-base font-medium">{this.props.title ?? 'Something went wrong'}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {this.state.error.message || 'An unexpected error occurred in this panel.'}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Reload workspace
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
