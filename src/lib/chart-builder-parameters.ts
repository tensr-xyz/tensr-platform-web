/** Everything that changes the drawn chart, so a different chart never reuses an open result tab. */
export function chartBuilderParameters(input: {
  kind: string;
  x: string;
  y: string;
  weightColumn: string | null;
  errorBars: string;
  filters: { id: string; operator: unknown; value: unknown }[];
}): Record<string, unknown> {
  return {
    x_column: input.x,
    y_column: input.y,
    chart_type: input.kind,
    weight_column: input.weightColumn,
    error_bars: input.errorBars,
    filters: input.filters,
  };
}
