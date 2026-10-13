import fs from 'fs';
import path from 'path';

import { countsFromDimension, inspectUploadFile } from './spreadsheet-probe';

const FIXTURE = path.resolve(__dirname, '../../../tensr-api/tests/fixtures/Raw Data 300426.xlsx');

describe('countsFromDimension', () => {
  it('reads an A1:M304 range', () => {
    expect(countsFromDimension('A1:M304')).toEqual({ rowCount: 304, colCount: 13 });
  });
});

describe('inspectUploadFile', () => {
  it('reads sheet, row, and column counts from the agency workbook', async () => {
    const bytes = fs.readFileSync(FIXTURE);
    const file = new File([new Uint8Array(bytes)], 'Raw Data 300426.xlsx');
    const facts = await inspectUploadFile(file);
    expect(facts).toMatchObject({
      fileType: 'xlsx',
      sheetCount: 1,
      rowCount: 304,
      colCount: 13,
      parserError: null,
    });
  });
});
