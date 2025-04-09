interface Column {
  id: string;
  type: string;
  // Add other column properties as needed
}

interface DataRow {
  id: string;
  [key: string]: any; // Allow dynamic properties with any value type
}

export const cleanValue = (value: any, type: string): any => {
  if (typeof value === 'string') {
    value = value.replace(/^['"](.*)['"]$/, '$1').trim();
  }

  switch (type) {
    case 'number':
      return value !== '' ? parseFloat(value) || 0 : null;
    case 'boolean':
      return Boolean(value);
    case 'date':
      return value ? value : null;
    default:
      return value;
  }
};

export const createProcessDataChunk =
  (columns: Column[]) =>
  (data: Array<Array<string>>, startRow: number): DataRow[] => {
    return data[0].map((_, rowIndex) => {
      const row: DataRow = { id: `row-${startRow + rowIndex}` };
      columns.forEach((col, colIndex) => {
        const value = data[colIndex][rowIndex];
        row[col.id] = cleanValue(value, col.type);
      });
      return row;
    });
  };
