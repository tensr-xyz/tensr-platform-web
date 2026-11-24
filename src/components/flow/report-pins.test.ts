import { deliverableOutputs, mergeProjectPins, pinsFromRuns } from './report-pins';

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

  it('keeps an output out of the deck when that pin says so', () => {
    const pins = pinsFromRuns([
      {
        id: 'r1',
        dataset_id: 'd1',
        in_report: true,
        report_pin: {
          headline: 'Aware is higher',
          deck: false,
          bars: [{ label: 'Aware', percent: 62 }],
        },
      },
      {
        id: 'r2',
        dataset_id: 'd1',
        in_report: true,
        report_pin: {
          headline: 'London is 42%',
          support: 'Satisfied',
          bars: [{ label: 'Satisfied', percent: 42 }],
        },
      },
    ]);
    expect(deliverableOutputs(pins, 'deck').map(item => item.title)).toEqual(['London is 42%']);
    expect(deliverableOutputs(pins, 'topline')).toHaveLength(2);
  });

  it('keeps a just-saved local pin when the server list is still stale', () => {
    const server = pinsFromRuns([
      {
        id: 'r1',
        dataset_id: 'd1',
        in_report: true,
        report_pin: { headline: 'Older finding' },
      },
    ]);
    const local = [
      {
        id: 'pin-r2',
        runId: 'r2',
        datasetId: 'd1',
        headline: 'Just added',
        support: '',
        citation: '',
        afterId: '',
        deck: true,
        topline: true,
        keepLive: true,
      },
    ];
    expect(
      mergeProjectPins(server, local)
        .map(pin => pin.runId)
        .sort()
    ).toEqual(['r1', 'r2']);
    expect(mergeProjectPins(server, local).find(pin => pin.runId === 'r1')?.headline).toBe(
      'Older finding'
    );
  });
});
