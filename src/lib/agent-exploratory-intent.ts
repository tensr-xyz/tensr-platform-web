/** Detect vague exploratory questions vs specific analysis requests. */

const EXPLORATORY_PATTERN =
  /what(?:'s| is) interesting|what should i run|what do you recommend|analyse my data|analyze my data|explore(?: my)?(?: data)?|where do i start|what can you tell me|give me an overview|help me explore/i;

const SPECIFIC_ANALYSIS_PATTERN =
  /regression|anova|t-test|ttest|correlation|compare|mann|kruskal|chi.?square|crosstab|logistic|predict|wilcoxon|shapiro|pca|cluster|factor|reliability|paired|descriptives|frequencies|probit|poisson|mcnemar|ancova|manova|kaplan|cox|arima|friedman|sign test|hotelling|dbscan|random forest|svm|gradient boost|neural network|stepwise|forward selection|backward elimination/i;

export function isExploratoryIntent(message: string): boolean {
  return EXPLORATORY_PATTERN.test(message.trim());
}

export function isSpecificAnalysisIntent(message: string): boolean {
  return SPECIFIC_ANALYSIS_PATTERN.test(message.trim());
}

export function shouldSuggestExploratoryAnalyses(message: string): boolean {
  return isExploratoryIntent(message) && !isSpecificAnalysisIntent(message);
}
