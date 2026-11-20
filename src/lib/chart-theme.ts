import { DEFAULT_CHART_PALETTE, type ReportTheme } from '@/lib/report-theme';

/** Hex fallbacks for SVG fills (CSS vars alone are unreliable in exported SVGs). */
export const CHART_SERIES_COLORS = [...DEFAULT_CHART_PALETTE] as string[];

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

/** Current Tensr look. APA is opt-in so existing charts stay as they are. */
export const CHART_STYLE_PRESETS = {
  default: {
    fontFamily: CHART_AXIS_TICK_STYLE.fontFamily,
    series: [...CHART_SERIES_COLORS],
    gridOpacity: CHART_GRID_STYLE.strokeOpacity,
    greyscale: false,
  },
  apa: {
    fontFamily: 'Arial, Helvetica, sans-serif',
    series: ['#222222', '#555555', '#888888', '#bbbbbb'],
    gridOpacity: 0,
    greyscale: true,
  },
} as const;

export type ChartStylePreset = keyof typeof CHART_STYLE_PRESETS;

/** Resolve series fills: APA wins, then team theme palette, then Tensr defaults. */
export function resolveSeriesColors(
  preset: ChartStylePreset = 'default',
  teamTheme?: Pick<ReportTheme, 'chartPalette'> | null,
  override?: string[] | null
): string[] {
  if (preset === 'apa') return [...CHART_STYLE_PRESETS.apa.series];
  if (override && override.length) return [...override];
  if (teamTheme?.chartPalette?.length) return [...teamTheme.chartPalette];
  return [...CHART_STYLE_PRESETS.default.series];
}
