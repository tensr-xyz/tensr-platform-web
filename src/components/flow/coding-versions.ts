/** Which coded working version a project is using, and whether a newer one exists. */

export type CodingFile = {
  id: string;
  name: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  lineageLabel?: string | null;
  producingOperation?: string | null;
  parentId?: string | null;
  originId?: string | null;
};

export function isCodingVersion(row: {
  lineageLabel?: string | null;
  lineage_label?: string | null;
  producingOperation?: string | null;
  producing_operation?: string | null;
}): boolean {
  const label = String(row.lineageLabel || row.lineage_label || '').toLowerCase();
  const op = String(row.producingOperation || row.producing_operation || '').toLowerCase();
  return label.includes('coded') || op.includes('open_end') || op === 'coded';
}

export function codingStamp(row: {
  createdAt?: string | null;
  updatedAt?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}): number {
  const raw = row.createdAt || row.created_at || row.updatedAt || row.updated_at || 0;
  const value = new Date(raw).getTime();
  return Number.isFinite(value) ? value : 0;
}

/** Coded versions for the same upload lineage as the open file, newest first. */
export function codingVersionsFor(files: CodingFile[], openId: string | undefined): CodingFile[] {
  if (!openId) return [];
  const byId = new Map(files.map(file => [file.id, file]));
  const open = byId.get(openId);
  if (!open) return [];
  const root =
    open.originId ||
    (() => {
      let current: CodingFile | undefined = open;
      const seen = new Set<string>();
      while (current?.parentId && !seen.has(current.parentId)) {
        seen.add(current.id);
        current = byId.get(current.parentId);
      }
      return current?.id || open.id;
    })();
  return files
    .filter(file => {
      if (!isCodingVersion(file)) return false;
      if (file.id === root || file.originId === root || file.parentId === root) return true;
      let current: CodingFile | undefined = file;
      const seen = new Set<string>();
      while (current?.parentId && !seen.has(current.parentId)) {
        if (current.parentId === root || current.originId === root) return true;
        seen.add(current.id);
        current = byId.get(current.parentId);
      }
      return current?.id === root;
    })
    .sort((left, right) => codingStamp(right) - codingStamp(left));
}

export function codingDateLabel(row: {
  createdAt?: string | null;
  updatedAt?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}): string {
  const stamp = codingStamp(row);
  if (!stamp) return '';
  return new Date(stamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function codingVersionStatus(
  files: CodingFile[],
  inUseId: string | undefined
): {
  inUseLabel: string;
  newerAvailable: boolean;
  newerId?: string;
  newerLabel?: string;
} {
  const coded = codingVersionsFor(files, inUseId);
  const inUse = files.find(file => file.id === inUseId) || null;
  const raw =
    (inUse && isCodingVersion(inUse)
      ? inUse.lineageLabel || inUse.name
      : coded.find(file => file.id === inUseId)?.lineageLabel) ||
    inUse?.name ||
    '';
  const date = inUse ? codingDateLabel(inUse) : '';
  const label =
    raw && date && !raw.toLowerCase().includes(date.toLowerCase()) ? `${raw} · ${date}` : raw;
  const newest = coded[0];
  const newerAvailable = Boolean(
    newest && inUseId && newest.id !== inUseId && codingStamp(newest) > codingStamp(inUse || {})
  );
  return {
    inUseLabel: label,
    newerAvailable,
    newerId: newerAvailable ? newest?.id : undefined,
    newerLabel: newerAvailable && newest ? codingDateLabel(newest) : undefined,
  };
}

/** After coding review Done: only adopt the new file when it is at least as new as the one in use. */
export function shouldAdoptCodingVersion(
  currentId: string | undefined,
  nextId: string,
  files: CodingFile[]
): boolean {
  if (!nextId) return false;
  if (!currentId || currentId === nextId) return true;
  const current = files.find(file => file.id === currentId);
  const next = files.find(file => file.id === nextId);
  if (!next) return true;
  if (!current) return true;
  return codingStamp(next) >= codingStamp(current);
}
