'use client';

import { Component, type ReactNode } from 'react';
import { FlowErrorState, FlowStatePage } from '@/components/flow/flow-not-found';

function reference(): string {
  const part = () => Math.random().toString(16).slice(2, 6);
  return `${part()}-${part()}`;
}

/** Catches a crash anywhere in the app shell and shows the designed error state. */
export class FlowErrorBoundary extends Component<
  { children: ReactNode },
  { failed: string | null }
> {
  state = { failed: null as string | null };

  static getDerivedStateFromError(): { failed: string } {
    return { failed: reference() };
  }

  componentDidCatch(error: unknown) {
    console.error('Flow crashed', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flow">
        <FlowStatePage>
          <FlowErrorState
            reference={this.state.failed}
            onRetry={() => this.setState({ failed: null })}
          />
        </FlowStatePage>
      </div>
    );
  }
}
