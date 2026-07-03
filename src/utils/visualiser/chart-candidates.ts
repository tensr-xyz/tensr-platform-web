import type { SchemaSummary } from './schema-compute';
import type { ChartCandidate } from '@/lib/visualiser/llm/prompts/chartSuggestions';

/**
 * Generates candidate charts based on data schema
 */
export function generateChartCandidates(schemaSummary: SchemaSummary): ChartCandidate[] {
  const candidates: ChartCandidate[] = [];
  const { columns } = schemaSummary;

  // Find date columns
  const dateColumns = columns.filter(c => c.stats.type === 'date');
  // Find numeric columns
  const numericColumns = columns.filter(c => c.stats.type === 'numeric');
  // Find categorical columns
  const categoricalColumns = columns.filter(c => c.stats.type === 'categorical');

  // Line charts: date vs numeric
  dateColumns.forEach(dateCol => {
    numericColumns.forEach(numCol => {
      candidates.push({
        id: `line-${dateCol.name}-${numCol.name}`,
        type: 'line',
        x: dateCol.name,
        y: numCol.name,
      });
    });
  });

  // Bar charts: categorical vs numeric (group mean)
  categoricalColumns.forEach(catCol => {
    numericColumns.forEach(numCol => {
      candidates.push({
        id: `bar-${catCol.name}-${numCol.name}`,
        type: 'bar',
        x: catCol.name,
        y: numCol.name,
      });
    });
  });

  // Histograms: numeric distributions
  numericColumns.forEach(numCol => {
    candidates.push({
      id: `hist-${numCol.name}`,
      type: 'histogram',
      x: numCol.name,
    });
  });

  // Pie charts: categorical distributions (top 10)
  categoricalColumns.forEach(catCol => {
    if ((catCol.stats.uniqueCount || 0) <= 10) {
      candidates.push({
        id: `pie-${catCol.name}`,
        type: 'pie',
        x: catCol.name,
      });
    }
  });

  // Scatter plots: numeric vs numeric
  numericColumns.forEach((numCol1, i) => {
    numericColumns.slice(i + 1).forEach(numCol2 => {
      candidates.push({
        id: `scatter-${numCol1.name}-${numCol2.name}`,
        type: 'scatter',
        x: numCol1.name,
        y: numCol2.name,
      });
    });
  });

  // Grouped bar charts: categorical x categorical breakdown with numeric
  if (categoricalColumns.length >= 2 && numericColumns.length > 0) {
    const cat1 = categoricalColumns[0];
    const cat2 = categoricalColumns[1];
    numericColumns.forEach(numCol => {
      candidates.push({
        id: `grouped-bar-${cat1.name}-${cat2.name}-${numCol.name}`,
        type: 'grouped-bar',
        x: cat1.name,
        y: numCol.name,
        breakdown: cat2.name,
      });
    });
  }

  return candidates;
}
