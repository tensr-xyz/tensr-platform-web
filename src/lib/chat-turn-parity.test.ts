import {
  changeOffersSeeDropped,
  chatRunFinishedWhileAway,
  chatTurnChangesFromToolResults,
  chatTurnUndoTarget,
  formatChatTurnChangesHeadline,
  notifyChatRunFinished,
  numberedNextStepsFromTurn,
  resolveNumberedNextStep,
  summarizeChatSteps,
} from './chat-turn-parity';

describe('summarizeChatSteps', () => {
  it('builds a Ran N steps headline with the first highlights', () => {
    expect(
      summarizeChatSteps([
        'Read the open file',
        'Checked Levene',
        'Ran one-way ANOVA',
        'Created output',
      ])
    ).toBe('Ran 4 steps · Read the open file · Checked Levene · Ran one-way ANOVA');
  });

  it('returns empty when there are no steps', () => {
    expect(summarizeChatSteps([])).toBe('');
  });
});

describe('numberedNextStepsFromTurn', () => {
  it('returns up to three numbered prompts after an analysis', () => {
    const steps = numberedNextStepsFromTurn({
      toolResults: [
        {
          name: 'run_analysis',
          args: { analysis_type: 'anova_oneway' },
          result: { ok: true },
        },
      ],
      hasOutput: true,
      columnLabels: ['Satisfaction', 'Brand', 'Region'],
    });
    expect(steps).toHaveLength(3);
    expect(steps.map(step => step.n)).toEqual([1, 2, 3]);
    expect(steps[0]?.label).toBe('Explain this result');
    expect(steps[1]?.label).toBe('Split by Brand');
    expect(steps[1]?.prompt).toContain('Brand');
    expect(steps.some(step => step.label === 'Add to the report')).toBe(true);
  });

  it('offers a change summary after a data edit', () => {
    const steps = numberedNextStepsFromTurn({
      toolResults: [
        {
          name: 'data_edit',
          args: { operation: 'recode', dataset_id: 'parent' },
          result: {
            ok: true,
            executed: true,
            operation: 'recode',
            answer_markdown: 'Recoded **Age** into bands.',
            parent_dataset_id: 'parent',
            derived_dataset_id: 'child',
          },
        },
      ],
    });
    expect(steps).toHaveLength(3);
    expect(steps.some(step => step.label === 'Summarise what changed')).toBe(true);
  });

  it('pads to three next steps after a plain reply', () => {
    const steps = numberedNextStepsFromTurn({
      hasOutput: false,
      steps: ['Reading the request'],
    });
    expect(steps).toHaveLength(3);
    expect(steps.map(step => step.n)).toEqual([1, 2, 3]);
    expect(steps[0]?.label).toBe('What should I check next?');
  });

  it('offers board / short / audience reshape when the report has pins', () => {
    const steps = numberedNextStepsFromTurn({
      hasReportPins: true,
    });
    expect(steps.map(step => step.label)).toEqual([
      'Board version (5 slides)',
      'Short version',
      'Refine for an audience',
    ]);
    expect(steps[0]?.prompt).toMatch(/5 slide/i);
  });

  it('offers reshape after a client deck fills the report', () => {
    const steps = numberedNextStepsFromTurn({
      toolResults: [
        {
          name: 'build_client_deck',
          args: {},
          result: { ok: true, procedure: 'build_client_deck', report_pages: 12 },
        },
      ],
    });
    expect(steps.map(step => step.label)).toEqual([
      'Board version (5 slides)',
      'Short version',
      'Refine for an audience',
    ]);
  });
});

describe('resolveNumberedNextStep', () => {
  const steps = numberedNextStepsFromTurn({
    toolResults: [{ name: 'run_analysis', args: { analysis_type: 'frequencies' }, result: {} }],
    columnLabels: ['Region'],
  });

  it('expands a lone number into the matching prompt', () => {
    expect(resolveNumberedNextStep('1', steps)).toBe(steps[0]?.prompt);
    expect(resolveNumberedNextStep('2.', steps)).toBe(steps[1]?.prompt);
    expect(resolveNumberedNextStep('3)', steps)).toBe(steps[2]?.prompt);
  });

  it('leaves ordinary messages alone', () => {
    expect(resolveNumberedNextStep('1 more table', steps)).toBeNull();
    expect(resolveNumberedNextStep('hello', steps)).toBeNull();
  });
});

describe('chatTurnChangesFromToolResults', () => {
  it('lists data edits with previous and current dataset ids', () => {
    const changes = chatTurnChangesFromToolResults([
      {
        name: 'data_edit',
        args: { dataset_id: 'v0', operation: 'recode' },
        result: {
          ok: true,
          executed: true,
          operation: 'recode',
          answer_markdown: 'Recoded **Age** into bands.',
          parent_dataset_id: 'v0',
          derived_dataset_id: 'v1',
        },
      },
      {
        name: 'run_analysis',
        args: { analysis_type: 'frequencies' },
        result: { ok: true },
      },
    ]);
    expect(changes).toEqual([
      {
        label: 'Recoded Age into bands.',
        operation: 'recode',
        previousDatasetId: 'v0',
        currentDatasetId: 'v1',
      },
    ]);
    expect(chatTurnUndoTarget(changes)).toEqual({
      previousDatasetId: 'v0',
      currentDatasetId: 'v1',
    });
  });

  it('reads parent ids from slim stream payloads and marks row drops', () => {
    const changes = chatTurnChangesFromToolResults([
      {
        name: 'data_edit',
        parent_dataset_id: 'v0',
        derived_dataset_id: 'v1',
        result: {
          ok: true,
          executed: true,
          operation: 'filter_apply',
          answer_markdown: 'Removed 12 respondents (name contains "test").',
          derived_dataset_id: 'v1',
          derived: { dataset_id: 'v1', parent_dataset_id: 'v0' },
        },
      } as never,
    ]);
    expect(changes).toEqual([
      {
        label: 'Removed 12 respondents (name contains "test").',
        operation: 'filter_apply',
        previousDatasetId: 'v0',
        currentDatasetId: 'v1',
        seeDropped: true,
      },
    ]);
    expect(changeOffersSeeDropped(changes[0]!)).toBe(true);
  });

  it('lists a v2 recode named by procedure (slim / history shape)', () => {
    const changes = chatTurnChangesFromToolResults([
      {
        name: 'recode',
        procedure: 'recode',
        derived_dataset_id: 'v1',
        parent_dataset_id: 'v0',
        result: {
          ok: true,
          executed: true,
          operation: 'recode',
          answer_markdown: 'Recoded profession into two groups.',
          derived_dataset_id: 'v1',
          parent_dataset_id: 'v0',
        },
      } as never,
    ]);
    expect(changes).toEqual([
      {
        label: 'Recoded profession into two groups.',
        operation: 'recode',
        previousDatasetId: 'v0',
        currentDatasetId: 'v1',
      },
    ]);
  });

  it('lists lineage-only entries when result is missing', () => {
    const changes = chatTurnChangesFromToolResults([
      {
        name: 'recode',
        derived_dataset_id: 'child',
        parent_dataset_id: 'parent',
        args: { analysis_type: 'recode', operation: 'recode' },
      } as never,
    ]);
    expect(changes).toEqual([
      {
        label: 'Recode',
        operation: 'recode',
        previousDatasetId: 'parent',
        currentDatasetId: 'child',
      },
    ]);
  });

  it('skips refused edits', () => {
    expect(
      chatTurnChangesFromToolResults([
        {
          name: 'data_edit',
          result: { ok: false, refused: true, answer_markdown: 'No.' },
        },
      ])
    ).toEqual([]);
  });

  it('formats the Paper 9e changes headline', () => {
    const changes = chatTurnChangesFromToolResults([
      {
        name: 'data_edit',
        result: {
          ok: true,
          answer_markdown: 'Recoded Age.',
          parent_dataset_id: 'v0',
          derived_dataset_id: 'v1',
        },
      },
      {
        name: 'data_edit',
        result: {
          ok: true,
          answer_markdown: 'Dropped test rows.',
          parent_dataset_id: 'v1',
          derived_dataset_id: 'v2',
        },
      },
    ]);
    expect(formatChatTurnChangesHeadline(changes)).toBe('2 changes · saved as a new version');
    expect(formatChatTurnChangesHeadline(changes, { versionLabel: 7 })).toBe(
      '2 changes · saved as version 7'
    );
    expect(formatChatTurnChangesHeadline(changes.slice(0, 1))).toBe(
      '1 change · saved as a new version'
    );
  });
});

describe('notifyChatRunFinished', () => {
  it('notifies only for a long run while the tab is hidden', () => {
    const shown: string[] = [];
    const startedAt = 1_000;
    expect(
      notifyChatRunFinished({
        title: 'Tensr finished a chat reply',
        body: 'Satisfaction differs by brand.',
        hidden: true,
        startedAt,
        now: startedAt + 9_000,
        notify: title => {
          shown.push(title);
        },
      })
    ).toBe(true);
    expect(shown).toEqual(['Tensr finished a chat reply']);
    expect(
      chatRunFinishedWhileAway({
        hidden: true,
        startedAt,
        now: startedAt + 9_000,
      })
    ).toBe(true);

    expect(
      notifyChatRunFinished({
        title: 'Tensr finished a chat reply',
        hidden: true,
        startedAt,
        now: startedAt + 1_000,
        notify: title => {
          shown.push(title);
        },
      })
    ).toBe(false);

    expect(
      notifyChatRunFinished({
        title: 'Tensr finished a chat reply',
        hidden: false,
        startedAt,
        now: startedAt + 9_000,
        notify: title => {
          shown.push(title);
        },
      })
    ).toBe(false);
  });
});
