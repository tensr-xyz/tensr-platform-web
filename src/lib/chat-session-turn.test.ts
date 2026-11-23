import { EMPTY_TURN_ANSWER } from '@/components/flow/chat-output';
import { restoredChatAnswer, savedChatTurn } from './chat-session-turn';

describe('savedChatTurn', () => {
  const older = { user: 'Compare the groups', answer: 'The first reply.' };

  it('returns the new saved answer for this question', () => {
    const saved = savedChatTurn(
      [
        older,
        {
          user: 'Compare the groups',
          answer: 'The later reply.',
          steps: [
            { name: 'model', message: 'Reading the request' },
            { name: 'code_open_text', message: 'Coding the open answers' },
          ],
        },
      ],
      'Compare the groups',
      'agent',
      1
    );

    expect(saved?.answer_markdown).toBe('The later reply.');
    expect(saved?.tool_trace).toEqual([
      { name: 'model', message: 'Reading the request' },
      { name: 'code_open_text', message: 'Coding the open answers' },
    ]);
  });

  it('waits while the new answer is not stored yet', () => {
    expect(savedChatTurn([older], 'Compare the groups', 'agent', 1)).toBeNull();
    expect(
      savedChatTurn(
        [older, { user: 'Compare the groups', answer: '' }],
        'Compare the groups',
        'agent',
        1
      )
    ).toBeNull();
  });

  it('does not reuse an answer from a different question', () => {
    expect(savedChatTurn([older], 'Show the weights', 'agent')).toBeNull();
  });
});

describe('restoredChatAnswer', () => {
  it('keeps a finished clarification reply', () => {
    expect(
      restoredChatAnswer({
        user: 'What share read it?',
        answer: 'Which definition should I use?',
        steps: [{ name: 'model', message: 'Reading the request' }],
      })
    ).toBe('Which definition should I use?');
  });

  it('salvages a lost reply from the result lead', () => {
    expect(
      restoredChatAnswer({
        user: 'Show the crosstab',
        answer: '',
        steps: [{ name: 'banner_table', message: 'Building the table' }],
        tool_results: [
          {
            summary: { line: 'Global Ledger reach is 39.4% among institutional investors.' },
          },
        ],
      })
    ).toContain('39.4%');
  });

  it('does not invent a finish message when there were no steps', () => {
    expect(restoredChatAnswer({ user: 'Hi', answer: '' })).toBe('');
  });

  it('falls back to the unfinished stub only when steps ran and nothing else remains', () => {
    expect(
      restoredChatAnswer({
        user: 'Go ahead',
        answer: '',
        steps: [{ name: 'model', message: 'Reading the request' }],
      })
    ).toBe(EMPTY_TURN_ANSWER);
  });
});
