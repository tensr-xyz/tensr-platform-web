import {
  chartsFromToolResults,
  collectOpenDatasetsFromTabs,
  deriveMessageUpdateFromLoopResponse,
  type AgentLoopResponse,
} from '@/lib/run-agent-loop';
import type { Tab } from '@/stores/tabs-store';
import { ViewType } from '@/stores/tabs-store';

describe('run-agent-loop client helpers', () => {
  it('collectOpenDatasetsFromTabs dedupes dataset ids across tabs', () => {
    const tabs: Tab[] = [
      {
        id: 'a',
        name: 'Sales',
        content: '',
        isDirty: false,
        type: ViewType.SPREADSHEET,
        data: { datasetId: '11111111-1111-4111-8111-111111111111' },
      },
      {
        id: 'b',
        name: 'Sales copy',
        content: '',
        isDirty: false,
        type: ViewType.SPREADSHEET,
        data: { datasetId: '11111111-1111-4111-8111-111111111111' },
      },
      {
        id: 'c',
        name: 'Costs',
        content: '',
        isDirty: false,
        type: ViewType.SPREADSHEET,
        data: { datasetId: '22222222-2222-4222-8222-222222222222' },
      },
    ];

    expect(collectOpenDatasetsFromTabs(tabs)).toEqual([
      {
        dataset_id: '11111111-1111-4111-8111-111111111111',
        label: 'Sales',
        filename: 'Sales',
      },
      {
        dataset_id: '22222222-2222-4222-8222-222222222222',
        label: 'Costs',
        filename: 'Costs',
      },
    ]);
  });

  it('deriveMessageUpdateFromLoopResponse maps clarification status', () => {
    const response: AgentLoopResponse = {
      status: 'clarification',
      mode: 'agent',
      answer_markdown: 'Which column?',
      clarification_questions: ['Age or PTS?'],
    };

    const patch = deriveMessageUpdateFromLoopResponse(response, {
      triggerMessage: 'correlate columns',
      datasetId: '11111111-1111-4111-8111-111111111111',
    });

    expect(patch.content).toContain('Which column?');
    expect(patch.content).toContain('Age or PTS?');
    expect(patch.isStreaming).toBe(false);
  });

  it('deriveMessageUpdateFromLoopResponse maps awaiting_approval to agent_tool_approval', () => {
    const response: AgentLoopResponse = {
      status: 'awaiting_approval',
      mode: 'plan',
      answer_markdown: 'Plan: run t-test',
      pending_approvals: [
        {
          tool_call_id: 'call_1',
          name: 'run_analysis',
          args: { analysis_type: 'ttest_independent' },
          rationale: 'Compare groups',
          why_this_test: 'Independent groups t-test',
        },
      ],
    };

    const patch = deriveMessageUpdateFromLoopResponse(response, {
      triggerMessage: 't-test Age by group',
      datasetId: '11111111-1111-4111-8111-111111111111',
    });

    expect(patch.pendingAction?.kind).toBe('agent_tool_approval');
    if (patch.pendingAction?.kind === 'agent_tool_approval') {
      expect(patch.pendingAction.toolCallId).toBe('call_1');
      expect(patch.pendingAction.whyThisTest).toBe('Independent groups t-test');
    }
  });

  it('chartsFromToolResults collects chart payloads', () => {
    const charts = chartsFromToolResults([
      {
        name: 'read_data',
        result: {
          chart: {
            kind: 'bar',
            title: 'Revenue',
            x_label: 'Region',
            y_label: 'Sum',
            categories: ['North'],
            values: [10],
          },
        },
      },
    ]);

    expect(charts).toHaveLength(1);
    expect(charts[0]?.title).toBe('Revenue');
  });
});
