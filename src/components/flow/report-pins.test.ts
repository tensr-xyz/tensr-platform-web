import { pinsFromRuns } from './report-pins';

describe('server report pins', () => {
  it('maps pinned runs from the run list', () => {
    const pins = pinsFromRuns([
      {
        id: 'r1',
        dataset_id: 'd1',
        in_report: true,
        report_pin: { headline: 'Aware is higher', citation: 'T1', after_id: 'f1', deck: false },
      },
      { id: 'r2', dataset_id: 'd1', in_report: false, report_pin: null },
    ]);
    expect(pins).toEqual([
      {
        id: 'pin-r1',
        runId: 'r1',
        datasetId: 'd1',
        headline: 'Aware is higher',
        support: '',
        citation: 'T1',
        afterId: 'f1',
        deck: false,
        topline: true,
        keepLive: true,
        bars: [],
      },
    ]);
  });
});
