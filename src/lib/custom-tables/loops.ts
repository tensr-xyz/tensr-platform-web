export type LoopDefinition = {
  id: string;
  stems?: string[];
  items?: string[];
  item_key?: string;
  item_title?: string;
  item_labels?: Record<string, string>;
  stem_labels?: Record<string, string>;
  stem_value_labels?: Record<string, Record<string, string>>;
  members?: Array<{ column?: string; stem?: string; item?: string }>;
  partial?: boolean;
  status?: string;
};

export type PickerColumn = {
  id: string;
  label: string;
  values?: string[];
  hideId?: boolean;
};

export function loopItemPlural(title: string | undefined): string {
  const name = (title || 'Brand').trim() || 'Brand';
  return /s$/i.test(name) ? name.toLowerCase() : `${name.toLowerCase()}s`;
}

/** "aware, owns, likes asked for brands A, B, C" */
export function loopProposalSentence(loop: LoopDefinition): string {
  const stems = (loop.stems || []).join(', ');
  const items = (loop.items || []).join(', ');
  return `${stems} asked for ${loopItemPlural(loop.item_title)} ${items}`;
}

function valueCodes(labels: Record<string, string> | undefined): string[] | undefined {
  const codes = Object.keys(labels || {});
  if (!codes.length) return undefined;
  return codes.sort((a, b) => {
    const left = Number(a);
    const right = Number(b);
    if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
    return a.localeCompare(b);
  });
}

/** Wide columns that belong in the loop group instead of the flat column list. */
export function loopMemberNames(loops: LoopDefinition[]): string[] {
  const names = new Set<string>();
  for (const loop of loops) {
    for (const member of loop.members || []) {
      if (member.column) names.add(member.column);
    }
  }
  return [...names];
}

/** At loop level the list is the brand column, the loop questions, and respondent columns. */
export function loopPickerColumns(
  sheet: Array<{ id: string; label: string }>,
  loop: LoopDefinition | null
): PickerColumn[] {
  if (!loop) return sheet.map(column => ({ id: column.id, label: column.label }));
  const members = new Set(
    (loop.members || [])
      .map(member => member.column)
      .filter((column): column is string => Boolean(column))
  );
  const brand: PickerColumn = {
    id: loop.item_key || 'item',
    label: (loop.item_title || 'Brand').trim() || 'Brand',
    values: [...(loop.items || [])],
    hideId: true,
  };
  const questions: PickerColumn[] = (loop.stems || []).map(stem => ({
    id: stem,
    label: loop.stem_labels?.[stem] || stem,
    values: valueCodes(loop.stem_value_labels?.[stem]),
  }));
  const respondent = sheet
    .filter(column => !members.has(column.id))
    .map(column => ({ id: column.id, label: column.label }));
  return [brand, ...questions, ...respondent];
}
