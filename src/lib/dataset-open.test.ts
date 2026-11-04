import { FIRST_OPEN_ROWS, previewPageUrl, readServerTiming } from './dataset-open';

describe('dataset open paging', () => {
  it('asks for the first 200 rows and a slim preview', () => {
    expect(FIRST_OPEN_ROWS).toBe(200);
    expect(previewPageUrl('ds-1', 200)).toBe('/datasets/ds-1/preview?offset=200&limit=200&slim=1');
  });

  it('reads Server-Timing durations', () => {
    expect(readServerTiming('load_df;dur=12.5, preview;dur=4.0')).toEqual({
      load_df: 12.5,
      preview: 4,
    });
    expect(readServerTiming(null)).toEqual({});
  });
});
