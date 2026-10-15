/** Starter chips from the open dataset, not a hardcoded NBA example. */

const HIDDEN = new Set(['_row_uid', '_source_row_uids', '_weight', 'select', 'id']);

export type StarterColumn = {
  id?: string;
  header?: string;
  type?: string;
  uniqueCount?: number;
};

function label(column: StarterColumn): string {
  return (column.header || column.id || '').trim();
}

function isNumeric(column: StarterColumn): boolean {
  return /number|numeric|float|int|decimal/i.test(column.type || '');
}

function nameLooksLikeId(name: string): boolean {
  for (const part of name.split(/[^A-Za-z0-9]+/).filter(Boolean)) {
    if (/^(id|uid|uuid)$/i.test(part)) return true;
    if (/(ID|Id)$/.test(part)) return true;
    if (
      /id$/i.test(part) &&
      /^(resp|response|respondent|user|participant|case|record|session)/i.test(part)
    ) {
      return true;
    }
  }
  return false;
}

function isHighUniquenessInteger(column: StarterColumn): boolean {
  if (typeof column.uniqueCount !== 'number' || column.uniqueCount < 40) return false;
  return isNumeric(column) || /int/i.test(column.type || '');
}

export function isIdColumn(column: StarterColumn): boolean {
  const raw = `${column.id || ''} ${column.header || ''}`;
  return nameLooksLikeId(raw) || isHighUniquenessInteger(column);
}

function isDateColumn(column: StarterColumn): boolean {
  const blob = `${column.type || ''} ${column.id || ''} ${column.header || ''}`.toLowerCase();
  return /date|datetime|timestamp/.test(blob);
}

/** More than about 12 distinct values is a continuous column, such as Age. */
function isContinuous(column: StarterColumn): boolean {
  return typeof column.uniqueCount === 'number' && column.uniqueCount > 12;
}

function crosstabColumns(columns: StarterColumn[]): StarterColumn[] {
  const eligible = columns.filter(
    column =>
      column.id &&
      !HIDDEN.has(column.id) &&
      !isNumeric(column) &&
      !isContinuous(column) &&
      !isIdColumn(column) &&
      !isDateColumn(column)
  );
  const counted = eligible.filter(column => typeof column.uniqueCount === 'number');
  if (counted.length) {
    return [...eligible].sort((a, b) => (a.uniqueCount ?? 99) - (b.uniqueCount ?? 99));
  }
  return eligible;
}

export function starterPromptsForColumns(
  columns: StarterColumn[],
  options?: { notebook?: boolean }
): string[] {
  const usable = columns.filter(
    column => column.id && !HIDDEN.has(column.id) && !isIdColumn(column)
  );
  const numeric = usable.filter(isNumeric);
  const categorical = crosstabColumns(columns);
  const continuous = usable.filter(column => isContinuous(column) && !isDateColumn(column));
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
    } else if (continuous[0] && categorical[0]) {
      prompts.push(
        `Bin ${label(continuous[0])} and crosstab it by ${label(categorical[0])} with column percentages`
      );
    } else if (continuous[0]) {
      prompts.push(`Bin ${label(continuous[0])} before using it in a crosstab`);
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
