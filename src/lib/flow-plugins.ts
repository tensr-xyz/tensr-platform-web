export const PLUGIN_CATEGORIES = [
  'All',
  'Cleaning',
  'Survey methods',
  'Charts',
  'Exports',
  'Your team',
] as const;

export type PluginCategory = (typeof PLUGIN_CATEGORIES)[number];

export type FlowPlugin = {
  pluginId: string;
  name: string;
  description?: string;
  authorId?: string;
  authorName?: string;
  language?: string;
  version?: string;
  tags?: string[];
  isPaid?: boolean;
  revenue?: { totalDownloads?: number };
};

const LANGUAGE_LABELS: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  r: 'R',
};

export function pluginByline(plugin: FlowPlugin): string {
  const key = (plugin.language || '').toLowerCase();
  const language = key ? LANGUAGE_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1) : '';
  const author = plugin.authorName || '';
  if (language && author) return `${language} · by ${author}`;
  return language || author;
}

/** A real download count. Zero is omitted so the card does not invent a marketplace figure. */
export function installCount(plugin: FlowPlugin): string | null {
  const count = plugin.revenue?.totalDownloads || 0;
  if (count <= 0) return null;
  if (count >= 1000) {
    const thousands = (count / 1000).toFixed(1).replace(/\.0$/, '');
    return `${thousands}k installs`;
  }
  return `${count} install${count === 1 ? '' : 's'}`;
}

export function isEditorsPick(plugin: FlowPlugin): boolean {
  return (plugin.tags || []).some(tag => /editor/.test(tag.toLowerCase()));
}

export function pluginMatches(
  plugin: FlowPlugin,
  options: {
    category: PluginCategory;
    query: string;
    mine: boolean;
    installed: ReadonlySet<string>;
    userIds: string[];
  }
): boolean {
  if (options.mine && !options.installed.has(plugin.pluginId)) return false;
  const needle = options.query.trim().toLowerCase();
  if (needle) {
    const haystack = `${plugin.name} ${plugin.description || ''}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  if (options.category === 'All') return true;
  if (options.category === 'Your team') {
    return Boolean(plugin.authorId && options.userIds.includes(plugin.authorId));
  }
  return (plugin.tags || []).some(tag => tag.toLowerCase() === options.category.toLowerCase());
}

export function languageAccepted(language: string): boolean {
  return language === 'typescript' || language === 'javascript';
}

export const PLUGIN_LANGUAGES = [
  { id: 'python', label: 'Python' },
  { id: 'r', label: 'R' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
] as const;

/** Stripe Connect does not pin a currency. Checkout uses this value. */
export const PLUGIN_CURRENCY = 'gbp';

export function pluginLanguageChoices(): { id: string; label: string; soon: boolean }[] {
  return PLUGIN_LANGUAGES.map(item => ({
    id: item.id,
    label: item.label,
    soon: !languageAccepted(item.id),
  }));
}

export function reviewLines(plugin: {
  status?: string;
  reviewNotes?: string;
  scanResults?: { passed?: boolean };
}): string[] {
  const lines: string[] = [];
  if (typeof plugin.scanResults?.passed === 'boolean') {
    lines.push(plugin.scanResults.passed ? 'Static scan passed' : 'Static scan failed');
  }
  if (plugin.status === 'APPROVED') lines.push('Published');
  else if (plugin.status === 'PENDING') lines.push('Manual review pending');
  else if (plugin.status === 'REJECTED') lines.push(plugin.reviewNotes || 'Rejected');
  return lines;
}

export function installErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : '';
  try {
    const body = JSON.parse(text) as { detail?: unknown };
    if (typeof body.detail === 'string' && body.detail) return body.detail;
  } catch {
    // The body is already plain text.
  }
  return text || 'Could not install this plugin.';
}
