import { savedChatTurn } from './chat-session-turn';

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
