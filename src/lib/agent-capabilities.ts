/**
 * Agent capability helpers for the web client.
 *
 * Catalog lists (aggregates / charts / filter ops) are **generated** from
 * tensr-api/app/assistant/capabilities.py — see agent-capabilities.generated.ts.
 * Do not hand-edit the generated file; run:
 *   python tensr-api/scripts/generate_agent_capabilities_ts.py
 *
 * At runtime, prefer GET /assistant/capabilities when the API is available so
 * the UI sees the live registry. The generated file is for build-time types,
 * offline tests, and synonym routing without an API round-trip.
 */

export {
  AGENT_AGGREGATES,
  AGENT_CHART_TYPES,
  AGENT_FILTER_OPERATORS,
  AGENT_FIDELITY_IDS,
  AGENT_CAPABILITY_CATALOG,
} from './agent-capabilities.generated';

/** Frontend-only menu synonym overrides (not part of the Python catalog). */
export const AGENT_MENU_SYNONYM_FIXES: Record<string, string> = {
  'factorial anova': 'Two-Way ANOVA',
  normality: 'Shapiro–Wilk Test',
  'test for normality': 'Shapiro–Wilk Test',
  'normality test': 'Shapiro–Wilk Test',
  'check normality': 'Shapiro–Wilk Test',
  'wilcoxon rank sum': 'Mann-Whitney U',
  'wilcoxon rank-sum': 'Mann-Whitney U',
  'rank sum test': 'Mann-Whitney U',
};

export function formatUnsupportedWithClosest(
  interpretation: string,
  closestMenuName?: string | null
): string {
  const base =
    interpretation.trim() || 'That request is not supported by the current analysis set.';
  if (closestMenuName) {
    return (
      `${base}\n\nClosest option in the Analyze menu: **${closestMenuName}**. ` +
      `Say if you want me to open that setup — I won't open it automatically.`
    );
  }
  return base;
}
