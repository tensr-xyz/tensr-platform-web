import { render } from '@testing-library/react';
import { ChatAnalysisApproval } from './index';
import type { ChatPendingAction } from '@/lib/chat-pending-action';

const PLAN = 'Waiting for approval: Plan 1. compute (Q1_top2, IF(Q1_Satisfaction >= 4, 1, 0))';

const action: ChatPendingAction = {
  kind: 'agent_tool_approval',
  status: 'pending',
  toolCallId: 'v2-batch',
  name: 'run_operations',
  args: {},
  rationale: PLAN,
  triggerMessage: 'Save a new variable Q1_top2',
};

describe('ChatAnalysisApproval', () => {
  it('shows the waiting plan once', () => {
    render(
      <ChatAnalysisApproval
        action={action}
        onSkip={() => undefined}
        onAccept={() => undefined}
        onManage={() => undefined}
      />
    );
    const hits = document.body.textContent?.match(/Waiting for approval: Plan 1\. compute/g) ?? [];
    expect(hits).toHaveLength(1);
  });
});
