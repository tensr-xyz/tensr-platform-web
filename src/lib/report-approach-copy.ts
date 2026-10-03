import type { AnalysisReport } from '@/lib/analysis-report-types';

const RAW_TRACE =
  /\brole=(primary|enrichment)\b|\bprior_result_id:|\brejected_alternative:|^Step \d+: `|\|\s*type=/m;

const STOPWORDS = new Set(
  'a an and as at by for from in into is of on or the to with this that it its be are was were not because those do does then'.split(
    ' '
  )
);

/** True for the tool-call trace (role=, call ids, rejected_alternative:), not prose. */
export function isRawExecutionTrace(text: string | null | undefined): boolean {
  return Boolean(text && RAW_TRACE.test(text));
}

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[`*_#>[\]()]/g, ' ')
    .split(/[^a-z0-9%]+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w))
    .map(w => w.slice(0, 6));
}

/** True when the alternative mostly restates the plan (same outcome and predictors). Compares 6-letter stems so "regress" matches "regression". */
export function alternativeRepeatsPlan(alternative: string, plan: string): boolean {
  const alt = contentWords(alternative);
  if (!alt.length) return true;
  const planWords = new Set(contentWords(plan));
  const shared = alt.filter(w => planWords.has(w)).length;
  return shared / alt.length >= 0.5;
}

export type ReportApproachCopy = {
  plan: string;
  whyThisTest: string;
  alternative: string;
  exploration: string;
  technicalDetails: string;
};

/** User-facing Approach text; internals go to `technicalDetails`. */
export function reportApproachCopy(report: AnalysisReport): ReportApproachCopy {
  const approach = report.approach ?? {};
  const rawAlternative = (approach.rejected_alternative ?? '').trim();
  let plan = (approach.plan ?? '').trim();
  if (rawAlternative && plan.includes(rawAlternative)) {
    plan = plan
      .replace(rawAlternative, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  const alternative =
    rawAlternative && !alternativeRepeatsPlan(rawAlternative, plan) ? rawAlternative : '';

  const exploration = (approach.exploration ?? '').trim();
  const trace = (report.session_trace ?? '').trim();
  const narrative = exploration && !isRawExecutionTrace(exploration) ? exploration : '';
  const technical = [trace, isRawExecutionTrace(exploration) ? exploration : '']
    .filter(Boolean)
    .filter((t, i, all) => all.indexOf(t) === i)
    .join('\n\n');

  return {
    plan,
    whyThisTest: (approach.why_this_test ?? '').trim(),
    alternative,
    exploration: narrative,
    technicalDetails: technical === narrative ? '' : technical,
  };
}
