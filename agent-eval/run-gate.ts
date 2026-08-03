/**
 * CLI used by the Promptfoo baseline provider.
 * Imports the real predicate modules via relative paths (tsx does not resolve @/).
 * Gate order must match src/lib/resolve-agent-gate.ts / agent-panel handleSendMessage.
 *
 * Usage: npx tsx agent-eval/run-gate.ts "Hello"
 */
import { shouldSuggestExploratoryAnalyses } from '../src/lib/agent-exploratory-intent';
import { resolveChatAction } from '../src/lib/chat-actions';
import { shouldRouteToInlineChart } from '../src/lib/chart-intent';
import { isPrepPlaybookTrigger } from '../src/lib/prep-playbook';
import { shouldRouteMessageToDataIntent } from '../src/lib/run-agent-data-action';

const ANALYSIS_QUESTION_RE =
  /(predict|analyze|analys|relationship|correlation|regression|anova|compare|difference|effect|impact|test|wilcoxon|mann|kruskal|chi|crosstab|pca|cluster|factor|reliability|normality|shapiro|sign test|mcnemar|probit|logistic|poisson|ttest|t-test|kappa|cohen|spearman|kendall|canonical|discriminant|manova|ancova|glmm|mixed model|survival|kaplan|cox|arima)/i;

const DATA_QUALITY_RE =
  /(data quality|quality scan|check data|data issues|scan data|data problems)/i;

function resolveGateInOrder(message: string): string {
  const text = (message || '').trim();
  if (!text) return 'tutor';

  const inlineChart = shouldRouteToInlineChart(text);
  if (!inlineChart) {
    const action = resolveChatAction(text);
    if (action.kind === 'analysis') return 'menu-analysis';
    if (action.kind === 'dialog') return 'menu-dialog';
    if (action.kind !== 'chat') return 'menu-other';
  }

  if (isPrepPlaybookTrigger(text)) return 'prep-playbook';
  if (shouldRouteMessageToDataIntent(text)) return 'data-intent';
  if (!inlineChart && shouldSuggestExploratoryAnalyses(text)) return 'exploratory';
  if (!inlineChart && ANALYSIS_QUESTION_RE.test(text)) return 'analysis-question';
  if (DATA_QUALITY_RE.test(text)) return 'data-quality';
  return 'tutor';
}

const prompt = process.argv.slice(2).join(' ');
process.stdout.write(resolveGateInOrder(prompt));
