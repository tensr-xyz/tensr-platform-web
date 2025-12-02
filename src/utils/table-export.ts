/**
 * Utility functions for exporting tables in various formats
 * for use in lab reports and documents
 */

export interface TableExportOptions {
  filename?: string;
  format?: 'png' | 'svg' | 'csv' | 'pdf' | 'text' | 'html';
}

/**
 * Export table as PNG image using html2canvas
 */
export async function exportTableAsImage(
  tableElement: HTMLElement,
  options: TableExportOptions = {}
): Promise<void> {
  const { filename = 'table' } = options;

  try {
    // Dynamic import to avoid loading if not needed
    const html2canvas = (await import('html2canvas')).default;

    const canvas = await html2canvas(tableElement, {
      backgroundColor: '#ffffff',
      scale: 2, // Higher quality
      logging: false,
    });

    canvas.toBlob(blob => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch (error) {
    console.error('Error exporting table as image:', error);
    throw new Error('Failed to export table as image. Please ensure html2canvas is installed.');
  }
}

/**
 * Export table as SVG
 */
export function exportTableAsSVG(
  tableElement: HTMLElement,
  options: TableExportOptions = {}
): void {
  const { filename = 'table' } = options;

  // Get table dimensions and styles
  const rect = tableElement.getBoundingClientRect();
  const styles = window.getComputedStyle(tableElement);

  // Create SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', rect.width.toString());
  svg.setAttribute('height', rect.height.toString());
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Create foreignObject to embed HTML table
  const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreignObject.setAttribute('width', '100%');
  foreignObject.setAttribute('height', '100%');

  // Clone and style the table
  const clonedTable = tableElement.cloneNode(true) as HTMLElement;
  clonedTable.style.margin = '0';
  clonedTable.style.padding = '0';

  foreignObject.appendChild(clonedTable);
  svg.appendChild(foreignObject);

  // Convert to blob and download
  const svgString = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export table as CSV
 */
export function exportTableAsCSV(
  tableElement: HTMLElement,
  options: TableExportOptions = {}
): void {
  const { filename = 'table' } = options;

  const rows: string[][] = [];
  const tableRows = tableElement.querySelectorAll('tr');

  tableRows.forEach(row => {
    const cells: string[] = [];
    row.querySelectorAll('th, td').forEach(cell => {
      cells.push(cell.textContent?.trim() || '');
    });
    if (cells.length > 0) {
      rows.push(cells);
    }
  });

  // Convert to CSV
  const csvContent = rows
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export table as formatted text (for Word/paste)
 */
export function exportTableAsText(
  tableElement: HTMLElement,
  options: TableExportOptions = {}
): void {
  const { filename = 'table' } = options;

  const rows: string[][] = [];
  const tableRows = tableElement.querySelectorAll('tr');

  tableRows.forEach(row => {
    const cells: string[] = [];
    row.querySelectorAll('th, td').forEach(cell => {
      cells.push(cell.textContent?.trim() || '');
    });
    if (cells.length > 0) {
      rows.push(cells);
    }
  });

  // Format as tab-separated (works well in Word)
  const textContent = rows.map(row => row.join('\t')).join('\n');

  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export table as HTML
 */
export function exportTableAsHTML(
  tableElement: HTMLElement,
  options: TableExportOptions = {}
): void {
  const { filename = 'table' } = options;

  // Clone the table with styles
  const clonedTable = tableElement.cloneNode(true) as HTMLElement;

  // Create HTML document
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <style>
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
  </style>
</head>
<body>
  ${clonedTable.outerHTML}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy table to clipboard as formatted text
 */
export async function copyTableToClipboard(tableElement: HTMLElement): Promise<void> {
  const rows: string[][] = [];
  const tableRows = tableElement.querySelectorAll('tr');

  tableRows.forEach(row => {
    const cells: string[] = [];
    row.querySelectorAll('th, td').forEach(cell => {
      cells.push(cell.textContent?.trim() || '');
    });
    if (cells.length > 0) {
      rows.push(cells);
    }
  });

  // Format as tab-separated (works well when pasting)
  const textContent = rows.map(row => row.join('\t')).join('\n');

  try {
    await navigator.clipboard.writeText(textContent);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    throw new Error('Failed to copy table to clipboard');
  }
}

/**
 * Main export function that routes to the appropriate format
 */
export async function exportTable(
  tableElement: HTMLElement,
  options: TableExportOptions
): Promise<void> {
  const { format = 'png', filename = 'table' } = options;

  switch (format) {
    case 'png':
      await exportTableAsImage(tableElement, { filename });
      break;
    case 'svg':
      exportTableAsSVG(tableElement, { filename });
      break;
    case 'csv':
      exportTableAsCSV(tableElement, { filename });
      break;
    case 'text':
      exportTableAsText(tableElement, { filename });
      break;
    case 'html':
      exportTableAsHTML(tableElement, { filename });
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
