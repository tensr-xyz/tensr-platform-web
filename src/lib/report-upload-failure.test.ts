import posthog from 'posthog-js';

import { reportUploadFailure } from './report-upload-failure';

jest.mock('posthog-js', () => ({
  captureException: jest.fn(),
}));

jest.mock('./spreadsheet-probe', () => ({
  inspectUploadFile: jest.fn(async () => ({
    fileType: 'xlsx',
    sheetCount: 1,
    rowCount: 304,
    colCount: 13,
    parserError: null,
  })),
}));

describe('reportUploadFailure', () => {
  it('records the workbook shape and shows the parser reason', async () => {
    const file = new File(['xlsx'], 'Raw Data 300426.xlsx');
    const error = new Error(
      JSON.stringify({
        detail: "Couldn't find a header row. The first 3 rows look like a title.",
      })
    );
    const shown = await reportUploadFailure(file, error);
    expect(shown).toBe("Couldn't find a header row. The first 3 rows look like a title.");
    expect(shown).not.toMatch(/columns exist/i);
    expect(posthog.captureException).toHaveBeenCalledWith(error, {
      file_type: 'xlsx',
      sheet_count: 1,
      row_count: 304,
      col_count: 13,
      parser_error: error.message,
    });
  });
});
