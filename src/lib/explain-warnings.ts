import { tensrApiUrl } from '@/lib/tensr-api-url';

/** One warning chip or structured warning for Explain this / Explain all (TEN-174). */
export type ExplainWarningInput =
  | string
  | {
      message?: string;
      label?: string;
      source?: string;
      analysis_key?: string;
      run_id?: string;
      output_id?: string;
    };

export type ExplainWarningsResponse = {
  markdown: string;
  source: string;
  scope: 'one' | 'all';
  warnings: Array<{
    message: string;
    source?: string | null;
    source_label?: string | null;
  }>;
  chat_prompt: string;
  n_warnings: number;
  model?: string;
  note?: string;
};

/** Build the POST body from output-check chips. Prefer warn chips; fall back to all. */
export function warningsFromOutputChecks(
  checks: Array<{ label: string; warn?: boolean }>,
  opts?: { all?: boolean }
): ExplainWarningInput[] {
  const warnOnly = checks.filter(check => check.warn && check.label.trim());
  const picked = opts?.all || warnOnly.length === 0 ? checks : warnOnly;
  return picked
    .map(check => check.label.trim())
    .filter(Boolean)
    .map(message => ({ message, source: 'output' as const }));
}

export function chatPromptForWarnings(
  warnings: ExplainWarningInput[],
  scope: 'one' | 'all' = 'one'
): string {
  const messages = warnings
    .map(item =>
      typeof item === 'string' ? item.trim() : String(item.message || item.label || '').trim()
    )
    .filter(Boolean);
  if (!messages.length) return '';
  if (scope === 'all' || messages.length > 1) {
    return (
      'Explain all of these warnings in plain language:\n' +
      messages.map((message, index) => `${index + 1}. ${message}`).join('\n')
    );
  }
  return `Explain this warning in plain language: ${messages[0]}`;
}

export async function explainWarnings(
  body: {
    warnings: ExplainWarningInput[];
    scope?: 'one' | 'all';
    datasetId?: string;
    projectId?: string;
    context?: string;
    useLlm?: boolean;
  },
  token: string
): Promise<ExplainWarningsResponse> {
  const res = await fetch(tensrApiUrl('/assistant/explain-warnings'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      warnings: body.warnings,
      scope: body.scope || (body.warnings.length > 1 ? 'all' : 'one'),
      dataset_id: body.datasetId || undefined,
      project_id: body.projectId || undefined,
      context: body.context || undefined,
      use_llm: Boolean(body.useLlm),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Explain warnings failed (${res.status})`);
  }
  return (await res.json()) as ExplainWarningsResponse;
}
