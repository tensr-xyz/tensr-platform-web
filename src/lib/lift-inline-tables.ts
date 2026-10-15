/** Put a markdown table written inside a sentence onto its own lines. */
export function liftInlineTables(text: string): string {
  return text
    .split('\n')
    .map(line => {
      if (!line.includes('---') || !line.includes('|')) return line;
      if (!line.includes('| |') && !line.includes('||')) return line;
      const start = line.indexOf('|');
      const before = line.slice(0, start).trim();
      const raw = line.slice(start);
      const end = raw.lastIndexOf('|');
      const after = raw.slice(end + 1).trim();
      const table = raw.slice(0, end + 1).replace(/\|\s*\|/g, '|\n|');
      return [before, table, after].filter(Boolean).join('\n\n');
    })
    .join('\n');
}
