const STORAGE_KEY = 'tensr.outputPreferences';

export type OutputPreferences = {
  apaFormat: boolean;
  decimalPlaces: number;
  includeCharts: boolean;
};

const DEFAULTS: OutputPreferences = {
  apaFormat: true,
  decimalPlaces: 3,
  includeCharts: true,
};

export function loadOutputPreferences(): OutputPreferences {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<OutputPreferences>;
    return {
      apaFormat: parsed.apaFormat ?? DEFAULTS.apaFormat,
      decimalPlaces:
        typeof parsed.decimalPlaces === 'number' ? parsed.decimalPlaces : DEFAULTS.decimalPlaces,
      includeCharts: parsed.includeCharts ?? DEFAULTS.includeCharts,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveOutputPreferences(prefs: OutputPreferences): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

const OUTPUT_ALIAS_PAIRS = [
  ['apa_format', 'apaFormat'],
  ['include_charts', 'includeCharts'],
  ['decimal_places', 'decimalPlaces'],
] as const;

/** The body the setup modal posts. One name per output field. */
export function analyzeRunBody(
  formBody: Record<string, unknown>,
  prefs: OutputPreferences
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    ...formBody,
    ...outputPreferencesToBody(prefs),
  };
  for (const [name, alias] of OUTPUT_ALIAS_PAIRS) {
    if (
      Object.prototype.hasOwnProperty.call(body, name) &&
      Object.prototype.hasOwnProperty.call(body, alias)
    ) {
      delete body[alias];
    }
  }
  return body;
}

/** Merged into every analyze POST body from the setup modal. */
export function outputPreferencesToBody(prefs: OutputPreferences): Record<string, unknown> {
  return {
    decimalPlaces: prefs.decimalPlaces,
    apaFormat: prefs.apaFormat,
    includeCharts: prefs.includeCharts,
  };
}
