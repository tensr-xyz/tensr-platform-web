/** Starter chips from the open dataset, not a hardcoded NBA example. */

const HIDDEN = new Set(['_row_uid', '_source_row_uids', '_weight', 'select', 'id']);

export type StarterColumn = {
  id?: string;
  header?: string;
  type?: string;
};

function label(column: StarterColumn): string {
  return (column.header || column.id || '').trim();
}

function isNumeric(column: StarterColumn): boolean {
  return /number|numeric|float|int|decimal/i.test(column.type || '');
}

export function starterPromptsForColumns(
  columns: StarterColumn[],
  options?: { notebook?: boolean }
): string[] {
  const usable = columns.filter(column => column.id && !HIDDEN.has(column.id));
  const numeric = usable.filter(isNumeric);
  const categorical = usable.filter(column => !isNumeric(column));
  const prompts: string[] = [];
  if (options?.notebook) {
    if (numeric.length >= 2) {
      prompts.push(`Plot ${label(numeric[0])} against ${label(numeric[1])}`);
      prompts.push(`Run a correlation matrix on the numeric columns`);
    }
    if (numeric[0]) prompts.push(`Flag outliers in ${label(numeric[0])}`);
    if (categorical[0] && numeric[0]) {
      prompts.push(`Group by ${label(categorical[0])} and summarise ${label(numeric[0])}`);
    }
  } else {
    if (categorical.length >= 2) {
      prompts.push(
        `Make a crosstab of ${label(categorical[0])} by ${label(categorical[1])} with column percentages`
      );
    }
    if (numeric.length >= 2) {
      prompts.push(`Plot the correlation between ${label(numeric[0])} and ${label(numeric[1])}`);
    } else if (numeric[0] && categorical[0]) {
      prompts.push(`Compare ${label(numeric[0])} across ${label(categorical[0])}`);
    }
    if (categorical[0]) {
      prompts.push(`Filter rows where ${label(categorical[0])} meets a condition`);
    }
    prompts.push('Summarise this dataset and flag outliers');
  }
  const unique = prompts.filter((prompt, index) => prompt && prompts.indexOf(prompt) === index);
  if (unique.length) return unique.slice(0, 5);
  return options?.notebook
    ? ['Summarise the numeric columns', 'Flag outliers in a numeric column']
    : [
        'Summarise this dataset and flag outliers',
        'Make a crosstab of two categorical columns with column percentages',
        'Compare a numeric column across groups',
      ];
}
