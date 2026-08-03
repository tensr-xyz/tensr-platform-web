# ReportChart axis formatting — status report

**Date:** 2026-08-03  
**Demo:** `/dev/chart-axis-demo` (before fixtures + live after panels)

## Audit by chart kind

| Kind                       | Gaps that applied                                                      | Approach                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **scatter / scatter_line** | No numeric ticks; fixed 420×200; axis title truncation only            | Continuous X/Y nice ticks + number/datetime formatters; size from measured width + `density`                                      |
| **histogram**              | No X/Y ticks (axis lines only); bin range unlabeled                    | X ticks from bin domain; Y ticks for counts; same formatters                                                                      |
| **bar_grouped / line**     | Y ticks missing; category labels hard-capped (~7–8 chars); no datetime | Y nice ticks; size-aware category plan (full → rotate 45° → skip); datetime categories auto-detected or via `x_scale: 'datetime'` |
| **boxplot**                | Y ticks missing; group labels capped at 8                              | Y nice ticks; same category label planner as bar                                                                                  |
| **path_diagram**           | No cartesian axes; only node label truncation                          | Size-aware node label length only (`comfortable` allows longer labels). Different approach by design — not a numeric axis chart   |

## What changed

1. **`src/utils/chart-axis.ts`** — nice ticks, number formatting (thousands separators, integer-aware precision), datetime parse/resolution/format, category label planner, layout from density + measured width.
2. **`ReportChart`** — `density: 'inline' | 'comfortable'`; `ResizeObserver` for width; shared `AxisFrame`; all cartesian kinds draw ticks.
3. **Hosts** — `AgentInlineChart` / `ReportChartCard` use `inline` in-card and `comfortable` in fullscreen; off-screen comfortable SVG feeds PNG/SVG download so export is not merely a 3× upscale of the cramped inline viewBox.
4. **Types** — optional `x_scale` / `y_scale`: `'linear' | 'datetime' | 'category'`.
5. **Export pipeline** — `CHART_EXPORT_PNG_SCALE = 3` unchanged; richer source SVG underneath.

## Consistency

| Surface                 | Density                                        | Axis fix                               |
| ----------------------- | ---------------------------------------------- | -------------------------------------- |
| Inline chat/report card | `inline`                                       | Ticks + smarter truncation/rotation    |
| Fullscreen dialog       | `comfortable`                                  | More ticks, larger type, longer labels |
| PNG/SVG download        | comfortable source (+ still 3× raster for PNG) | Same readable axes as fullscreen       |

## Tests

- `src/utils/chart-axis.test.ts`
- `src/components/molecules/report-chart/report-chart.test.tsx`

## Before / after examples

Live demo: `/dev/chart-axis-demo`

| Example                              | Path                                                                  |
| ------------------------------------ | --------------------------------------------------------------------- |
| Scatter before                       | `docs/chart-axis-examples/before-scatter.svg`                         |
| Scatter after (inline / comfortable) | `after-scatter-inline.svg`, `after-scatter-comfortable.svg`           |
| Histogram after                      | `after-histogram-comfortable.svg`                                     |
| Long bar labels before / after       | `before-bar-long-labels.svg`, `after-bar-long-labels-comfortable.svg` |
| Datetime line after                  | `after-datetime-line-comfortable.svg`                                 |
| Viewport screenshots                 | `demo-viewport-scatter.png`, `demo-viewport-bar-datetime.png`         |

Verified in browser: scatter ticks `0/20/40/60` (inline) and denser comfortable ticks; bar categories show full venue names (rotated); datetime axis shows `Jan 2024`…`Jun 2024` with thousands-separated Y ticks.
