import JSZip from 'jszip';

import { countsFromDimension, inspectUploadFile } from './spreadsheet-probe';

describe('countsFromDimension', () => {
  it('reads an A1:M304 range', () => {
    expect(countsFromDimension('A1:M304')).toEqual({ rowCount: 304, colCount: 13 });
  });
});

describe('inspectUploadFile', () => {
  it('reads sheet, row, and column counts from workbook XML', async () => {
    const zip = new JSZip();
    zip.file(
      'xl/workbook.xml',
      '<?xml version="1.0"?><workbook><sheets><sheet name="Raw Data"/></sheets></workbook>'
    );
    zip.file(
      'xl/worksheets/sheet1.xml',
      '<?xml version="1.0"?><worksheet><dimension ref="A1:M304"/></worksheet>'
    );
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const file = new File([bytes], 'Raw Data 300426.xlsx');
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
