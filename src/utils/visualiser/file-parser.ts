import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Column } from '@/types/visualiser/spreadsheet';

export interface ParsedFileData {
  data: Record<string, any>[];
  columns: Column[];
  totalRows: number;
  totalColumns: number;
}

export async function parseCSV(file: File): Promise<ParsedFileData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`));
          return;
        }

        const data = results.data as Record<string, any>[];
        const firstRow = data[0] || {};
        const columnNames = Object.keys(firstRow);

        const columns: Column[] = columnNames.map(name => ({
          id: name,
          accessor: name,
          header: name,
          width: 150,
          type: 'string',
        }));

        resolve({
          data,
          columns,
          totalRows: data.length,
          totalColumns: columnNames.length,
        });
      },
      error: error => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      },
    });
  });
}

export async function parseExcel(file: File): Promise<ParsedFileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = e => {
      try {
        const arrayBuffer = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length === 0) {
          reject(new Error('Excel file is empty'));
          return;
        }

        // First row is headers
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1);

        // Convert to object array
        const data = rows.map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] ?? '';
          });
          return obj;
        });

        const columns: Column[] = headers.map(name => ({
          id: name,
          accessor: name,
          header: name,
          width: 150,
          type: 'string',
        }));

        resolve({
          data,
          columns,
          totalRows: data.length,
          totalColumns: headers.length,
        });
      } catch (error) {
        reject(
          new Error(
            `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

export async function parseFile(file: File): Promise<ParsedFileData> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    return parseCSV(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcel(file);
  } else {
    throw new Error(`Unsupported file type: ${extension}`);
  }
}
