import { buildExplainThisPanel, careLinesFromChecks, seedChatDraft } from './explain-this';

describe('explain this panel (Paper 10g)', () => {
  it('builds sections from lead, warn checks, and footnote without inventing numbers', () => {
    const panel = buildExplainThisPanel({
      title: 'T7 · Satisfaction by region',
      lead: 'London (63%) is significantly lower than the total (71%). The other regions are within normal variation.',
      checks: ['Low base on Wales', 'Weight applied'],
      footnote: 'weighted data · 95% confidence · base excludes 12 routed out',
    });

    expect(panel.sections[0]?.label).toBe('What it shows');
    expect(panel.sections[0]?.body).toContain('T7 · Satisfaction by region');
    expect(panel.sections[1]?.body).toContain('London (63%)');
    expect(panel.sections[2]?.body).toContain('Low base on Wales');
    expect(panel.basedOn).toContain('weighted data');
    expect(panel.reportNotePrompt).toContain('Add this explanation to the report as a note');
    expect(panel.chatPrompt).toContain('T7 · Satisfaction by region');
  });

  it('falls back when lead and checks are missing', () => {
    const panel = buildExplainThisPanel({ title: 'Banner table' });
    expect(panel.sections[0]?.body).toContain('Banner table');
    expect(panel.sections[1]?.body).toMatch(/No highlight/i);
    expect(panel.sections[2]?.body).toMatch(/No method warnings/i);
    expect(panel.basedOn).toMatch(/Based on/i);
  });

  it('prefers warn-like checks for Read with care', () => {
    expect(careLinesFromChecks(['Sig 95%', 'Low base on Region'])).toEqual(['Low base on Region']);
  });

  it('seeds the chat draft and returns the chat path', () => {
    const setItem = jest.fn();
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: { setItem, getItem: jest.fn(), removeItem: jest.fn() },
    });
    const href = seedChatDraft('proj-1', 'Explain this warning');
    expect(href).toBe('/flow/p/proj-1/chat');
    expect(setItem).toHaveBeenCalledWith('tensr-chat-draft:proj-1', 'Explain this warning');
  });
});
