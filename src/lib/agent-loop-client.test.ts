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

  it('does not duplicate identical clarification answer and questions', () => {
    const response: AgentLoopResponse = {
      status: 'clarification',
      mode: 'plan',
      answer_markdown: 'Could you specify the analysis (or columns) you want me to use?',
      clarification_questions: ['Could you specify the analysis (or columns) you want me to use?'],
    };

    const patch = deriveMessageUpdateFromLoopResponse(response, {
      triggerMessage: 'find what predicts points',
      datasetId: null,
    });

    const content = patch.content ?? '';
    expect(content).toBe('Could you specify the analysis (or columns) you want me to use?');
    expect(content.match(/Could you specify/g)?.length).toBe(1);
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
      expect(patch.pendingAction.pipelineSteps).toBeUndefined();
    }
  });

  it('maps multi-step pipeline approval onto pipelineSteps', () => {
    const response: AgentLoopResponse = {
      status: 'awaiting_approval',
      mode: 'plan',
      answer_markdown: 'Plan (3 steps — one approval)',
      pipeline: true,
      approval_batch: true,
      pending_approvals: [
        {
          tool_call_id: 's1',
          name: 'data_edit',
          args: { spec: { op: 'filter' } },
          rationale: 'Exclude actives',
          why_this_test: 'Apply churn definition',
        },
        {
          tool_call_id: 's2',
          name: 'run_analysis',
          args: { analysis_type: 'descriptives' },
          rationale: 'Normality screen',
          why_this_test: 'Check distributions',
        },
        {
          tool_call_id: 's3',
          name: 'run_analysis',
          args: { analysis_type: 'logistic_regression' },
          rationale: 'Drivers model',
          why_this_test: 'Logistic regression',
        },
      ],
    };

    const patch = deriveMessageUpdateFromLoopResponse(response, {
      triggerMessage: "find what's driving churn",
      datasetId: '11111111-1111-4111-8111-111111111111',
    });

    expect(patch.pendingAction?.kind).toBe('agent_tool_approval');
    if (patch.pendingAction?.kind === 'agent_tool_approval') {
      expect(patch.pendingAction.pipelineSteps).toHaveLength(3);
      expect(patch.pendingAction.pipelineSteps?.[2].name).toBe('run_analysis');
    }
  });

  it('copies recode coverage_line onto the approval card payload', () => {
    const response: AgentLoopResponse = {
      status: 'awaiting_approval',
      mode: 'plan',
      answer_markdown: 'Plan: recode Pos',
      pending_approvals: [
        {
          tool_call_id: 'call_recode',
          name: 'data_edit',
          args: { operation: 'recode' },
          rationale: 'Collapse Pos into PosGroup',
          why_this_test: 'Two role groups for ANOVA',
          coverage_line: '1 value not covered: SF-PF (1 row)',
        },
      ],
    };

    const patch = deriveMessageUpdateFromLoopResponse(response, {
      triggerMessage: 'recode Pos then ANOVA',
      datasetId: '11111111-1111-4111-8111-111111111111',
    });

    expect(patch.pendingAction?.kind).toBe('agent_tool_approval');
    if (patch.pendingAction?.kind === 'agent_tool_approval') {
      expect(patch.pendingAction.coverageLine).toBe('1 value not covered: SF-PF (1 row)');
    }
    expect(patch.thinkingLines).toBeUndefined();
    expect(patch.isStreaming).toBe(false);
  });

  it('clears thinkingLines on clarification, approval, and completed answers', () => {
    const clarification = deriveMessageUpdateFromLoopResponse(
      {
        status: 'clarification',
        mode: 'agent',
        answer_markdown: 'Which columns?',
        clarification_questions: ['Which columns?'],
      },
      { triggerMessage: 'use the two COHS subscales', datasetId: null }
    );
    expect(clarification.thinkingLines).toBeUndefined();
    expect(clarification.isStreaming).toBe(false);

    const done = deriveMessageUpdateFromLoopResponse(
      { status: 'ok', mode: 'agent', answer_markdown: 'Odds ratio 0.59' },
      { triggerMessage: 'give me odds ratios', datasetId: null }
    );
    expect(done.thinkingLines).toBeUndefined();
    expect(done.isStreaming).toBe(false);
  });

  it('keeps lastFittedModel on the chat message so follow-ups inherit the spec', () => {
    const spec = {
      analysis_type: 'logistic_regression',
      request_body: {
        dependent: 'Full_retention',
        independents: ['Interval', 'Pay', 'Total_approvals'],
        reference_levels: { Interval: 'short', Pay: 'low' },
      },
    };
    const patch = deriveMessageUpdateFromLoopResponse(
      {
        status: 'ok',
        mode: 'agent',
        answer_markdown: `Fitted.\n<!-- tensr_last_model:${JSON.stringify(spec)} -->`,
        tool_results: [
          {
            name: 'run_analysis',
            result: { ok: true, last_fitted_model: spec },
          },
        ],
      },
      { triggerMessage: 'interaction logistic', datasetId: null }
    );
    expect(patch.lastFittedModel).toEqual(spec);
    expect(patch.content).toBe('Fitted.');
    expect(patch.thinkingLines).toBeUndefined();
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
