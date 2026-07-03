export function isChartIntent(message: string): boolean {
  return /\b(plot|chart|graph|distribution|visuali[sz]e|scatter|histogram|correlation)\b/i.test(
    message
  );
}

/** Plot/chart prompts should render inline charts, not open analysis setup or planner. */
export function shouldRouteToInlineChart(message: string): boolean {
  return (
    isChartIntent(message) && /\b(plot|chart|graph|scatter|histogram|visuali[sz]e)\b/i.test(message)
  );
}
