import { chatRunInFlight, liveChatRun, publishLiveChatRun } from './chat-live-run';

describe('live chat run', () => {
  afterEach(() => publishLiveChatRun(null));

  it('a new chat drops the previous session so the next send starts clean', () => {
    publishLiveChatRun({
      projectId: 'project',
      sessionId: 'previous',
      question: 'Count region',
      answer: 'Done',
      steps: [],
      status: null,
      running: false,
    });
    publishLiveChatRun(null);
    expect(liveChatRun()).toBeNull();
    expect(chatRunInFlight('project')).toBe(false);
  });
});
