/** Put a markdown table written inside a sentence onto its own lines. */
export function liftInlineTables(text: string): string {
  return text
    .split('\n')
    .map(line => {
      if (!line.includes('---') || !line.includes('|')) return line;
      if (!line.includes('| |') && !line.includes('||')) return line;
      const start = line.indexOf('|');
      const before = line.slice(0, start).trim();
      const table = line.slice(start).replace(/\|\s*\|/g, '|\n|');
      return before ? `${before}\n\n${table}` : table;
    })
    .join('\n');
}
