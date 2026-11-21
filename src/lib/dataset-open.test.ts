import { FIRST_OPEN_COLS, FIRST_OPEN_ROWS, previewPageUrl, readServerTiming } from './dataset-open';

describe('dataset open paging', () => {
  it('asks for the first 200 rows, 80 columns, and a slim preview', () => {
    expect(FIRST_OPEN_ROWS).toBe(200);
    expect(FIRST_OPEN_COLS).toBe(80);
    expect(previewPageUrl('ds-1', 200)).toBe(
      '/datasets/ds-1/preview?offset=200&limit=200&slim=1&column_offset=0&column_limit=80'
    );
  });

  it('pages columns when the sheet scrolls sideways', () => {
    expect(previewPageUrl('ds-1', 0, 50, 80, 40)).toBe(
      '/datasets/ds-1/preview?offset=0&limit=50&slim=1&column_offset=80&column_limit=40'
    );
  });

  it('reads Server-Timing durations', () => {
    expect(readServerTiming('load_df;dur=12.5, preview;dur=4.0')).toEqual({
      load_df: 12.5,
      preview: 4,
    });
    expect(readServerTiming(null)).toEqual({});
  });
});
