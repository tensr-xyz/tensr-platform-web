import { ViewType, useTabsStore } from '@/stores/tabs-store';
import { openReportTab } from './open-report-tab';

describe('openReportTab', () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: '' });
  });

  it('does not point the workspace at a tab that is gone', () => {
    expect(openReportTab('missing')).toEqual({ ok: false, reason: 'missing_tab' });
    expect(useTabsStore.getState().activeTabId).toBe('');
  });

  it('focuses an existing report and says when it was already open', () => {
    useTabsStore.setState({
      activeTabId: 'tab-1',
      tabs: [
        {
          id: 'tab-1',
          name: 'Crosstab',
          type: ViewType.ANALYSIS_RESULT,
          content: '',
          isDirty: false,
          data: { analysisReport: { summary: 'ok' } as never },
        },
      ],
    });
    expect(openReportTab('tab-1')).toEqual({
      ok: true,
      alreadyOpen: true,
      reportMissing: false,
    });
  });

  it('flags a results tab that never received a report', () => {
    useTabsStore.setState({
      activeTabId: 'sheet',
      tabs: [
        {
          id: 'tab-2',
          name: 'Crosstab',
          type: ViewType.ANALYSIS_RESULT,
          content: '',
          isDirty: false,
          data: { analysisOp: 'banner_table' },
        },
      ],
    });
    expect(openReportTab('tab-2')).toEqual({
      ok: true,
      alreadyOpen: false,
      reportMissing: true,
    });
    expect(useTabsStore.getState().activeTabId).toBe('tab-2');
  });
});
