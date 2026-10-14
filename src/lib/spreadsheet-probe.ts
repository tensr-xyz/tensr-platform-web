import JSZip from 'jszip';

export type UploadFileFacts = {
  fileType: string;
  sheetCount: number | null;
  rowCount: number | null;
  colCount: number | null;
  parserError: string | null;
};

function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() || 'unknown';
}

function columnIndex(letters: string): number {
  let index = 0;
  for (const char of letters.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index;
}

/** A1:M304 → 304 rows, 13 columns. */
export function countsFromDimension(ref: string): { rowCount: number; colCount: number } | null {
  const match = ref.trim().match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
  if (!match) return null;
  const startCol = columnIndex(match[1]);
  const startRow = Number(match[2]);
  const endCol = match[3] ? columnIndex(match[3]) : startCol;
  const endRow = match[4] ? Number(match[4]) : startRow;
  if (!startRow || !endRow) return null;
  return {
    rowCount: Math.abs(endRow - startRow) + 1,
    colCount: Math.abs(endCol - startCol) + 1,
  };
}

async function readFileBytes(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsArrayBuffer(file);
  });
}

async function probeXlsx(file: File): Promise<UploadFileFacts> {
  const facts: UploadFileFacts = {
    fileType: 'xlsx',
    sheetCount: null,
    rowCount: null,
    colCount: null,
    parserError: null,
  };
  try {
    const zip = await JSZip.loadAsync(await readFileBytes(file));
    const workbook = await zip.file('xl/workbook.xml')?.async('string');
    if (workbook) {
      facts.sheetCount = (workbook.match(/<sheet[\s>]/g) || []).length;
    }
    const sheetName = Object.keys(zip.files).find(name =>
      /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)
    );
    const sheet = sheetName ? await zip.file(sheetName)?.async('string') : null;
    const dimension = sheet?.match(/<dimension[^>]*ref="([^"]+)"/i)?.[1];
    if (dimension) {
      const counts = countsFromDimension(dimension);
      facts.rowCount = counts?.rowCount ?? null;
      facts.colCount = counts?.colCount ?? null;
    }
  } catch (error) {
    facts.parserError = error instanceof Error ? error.message : String(error);
  }
  return facts;
}

/** Best-effort shape for an upload error. Never throws. */
export async function inspectUploadFile(file: File): Promise<UploadFileFacts> {
  const fileType = extensionOf(file.name);
  if (fileType === 'xlsx' || fileType === 'xlsm') {
    const facts = await probeXlsx(file);
    facts.fileType = fileType;
    return facts;
  }
  if (fileType === 'csv') {
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      return {
        fileType,
        sheetCount: 1,
        rowCount: lines.length,
        colCount: lines[0] ? lines[0].split(',').length : 0,
        parserError: null,
      };
    } catch (error) {
      return {
        fileType,
        sheetCount: null,
        rowCount: null,
        colCount: null,
        parserError: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return {
    fileType,
    sheetCount: null,
    rowCount: null,
    colCount: null,
    parserError: null,
  };
}
