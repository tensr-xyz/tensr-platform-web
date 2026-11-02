/** Mini column chart. Bar heights come from the values passed in, which are the loaded page. */
export function ColumnSpark({ values }: { values: string[] }) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim() || '—';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const bars = [...counts.values()].slice(0, 8);
  const max = Math.max(...bars, 1);
  if (!bars.length) return null;
  return (
    <span className="column-spark" aria-hidden>
      {bars.map((count, index) => (
        <i key={index} style={{ height: `${Math.max(2, Math.round((count / max) * 10))}px` }} />
      ))}
    </span>
  );
}

export function valueCounts(values: string[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim() || '—';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}
