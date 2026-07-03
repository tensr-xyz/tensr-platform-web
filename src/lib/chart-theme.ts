/** Tensr chart canvas palette — aligned with brand purple accent in globals.css */
export const CHART_SERIES_COLORS = [
  'hsl(var(--primary))',
  'hsl(262 52% 52%)',
  'hsl(199 75% 48%)',
  'hsl(168 55% 42%)',
  'hsl(32 90% 52%)',
  'hsl(340 65% 52%)',
  'hsl(210 40% 55%)',
  'hsl(145 45% 42%)',
] as const;

export const CHART_AXIS_TICK_STYLE = {
  fontSize: 11,
  fontWeight: 450,
  fontFamily: 'SuisseIntl, var(--font-sans), system-ui, sans-serif',
  fill: 'hsl(var(--muted-foreground))',
} as const;

export const CHART_GRID_STYLE = {
  stroke: 'hsl(var(--border))',
  strokeOpacity: 0.65,
} as const;

export const CHART_CURSOR_FILL = 'hsl(var(--primary) / 0.08)';
