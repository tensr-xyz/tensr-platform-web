/** Pure helpers for the plugin detail, install, my-plugins and admin review screens. */

export type PluginPricing = {
  model?: 'one-time' | 'subscription' | string;
  price?: number;
  currency?: string;
  subscriptionInterval?: 'monthly' | 'yearly' | string | null;
  trialDays?: number | null;
};

export type PluginCapabilities = {
  inputTypes?: string[];
  outputTypes?: string[];
  network?: boolean;
  filesystem?: string;
  maxMemoryMb?: number;
  maxExecutionSeconds?: number;
  dataAccess?: string[];
};

export type PluginScan = {
  passed?: boolean;
  findings?: string[];
  scannedAt?: string;
  severity?: string;
};

/** The record GET /plugins/{id} returns (plugins_db._plugin_row_to_record). */
export type PluginRecord = {
  pluginId: string;
  version?: string;
  name: string;
  description?: string;
  authorId?: string;
  authorName?: string | null;
  language?: string;
  status?: string;
  isPaid?: boolean;
  pricing?: PluginPricing | null;
  tags?: string[];
  thumbnailUrl?: string;
  capabilities?: PluginCapabilities;
  manifest?: { authorEmail?: string | null; homepage?: string | null } | null;
  scanResults?: PluginScan | null;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
  revenue?: { totalDownloads?: number } | null;
};

const SYMBOLS: Record<string, string> = { gbp: '£', usd: '$', eur: '€' };

export function money(amount: number, currency = 'usd'): string {
  const code = currency.toLowerCase();
  const symbol = SYMBOLS[code];
  const whole = Number.isInteger(amount);
  const text = whole ? String(amount) : amount.toFixed(2);
  return symbol ? `${symbol}${text}` : `${text} ${code.toUpperCase()}`;
}

/** "£12 / month", "£40 one-off", or null when the plugin is free or has no price. */
export function priceLabel(pricing: PluginPricing | null | undefined): string | null {
  if (!pricing || typeof pricing.price !== 'number' || pricing.price <= 0) return null;
  const amount = money(pricing.price, pricing.currency);
  if (pricing.model === 'subscription') {
    return `${amount} / ${pricing.subscriptionInterval === 'yearly' ? 'year' : 'month'}`;
  }
  return `${amount} one-off`;
}

export function installLabel(plugin: Pick<PluginRecord, 'isPaid' | 'pricing'>): string {
  const price = plugin.isPaid ? priceLabel(plugin.pricing) : null;
  return price ? `Install · ${price}` : 'Install';
}

export function trialLine(pricing: PluginPricing | null | undefined): string | null {
  if (!pricing || pricing.model !== 'subscription') return null;
  const days = pricing.trialDays || 0;
  return days > 0 ? `${days}-day free trial · cancel any time` : 'Cancel any time';
}

const LANGUAGES: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  r: 'R',
};

export function languageLabel(language: string | undefined): string | null {
  if (!language) return null;
  const key = language.toLowerCase();
  return LANGUAGES[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

export function initialOf(name: string | undefined): string {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

export function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "6 hours", "2 days" since the given time. */
export function ageLabel(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const minutes = Math.max(0, Math.floor((now - then) / 60000));
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour' : `${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day' : `${days} days`;
}

export type PermissionLine = { allowed: boolean; text: string };

const ACCESS_TEXT: Record<string, string> = {
  schema: 'Column names and types',
  columns: 'Values in the columns you run it on',
  rows: 'Respondent-level rows',
  metadata: 'Dataset details such as name and size',
};

/** What the plugin can and cannot see, from its declared capabilities. */
export function permissionLines(caps: PluginCapabilities | null | undefined): PermissionLine[] {
  if (!caps) return [];
  const access = caps.dataAccess || [];
  const lines: PermissionLine[] = access.map(token => ({
    allowed: true,
    text: ACCESS_TEXT[token] || token,
  }));
  if (caps.filesystem === 'scratch') {
    lines.push({ allowed: true, text: 'A scratch folder that is cleared after each run' });
  }
  if (access.length && !access.includes('rows')) {
    lines.push({ allowed: false, text: 'Respondent-level rows' });
  }
  if (caps.network === false) {
    lines.push({ allowed: false, text: 'The internet. It cannot send your data anywhere.' });
  } else if (caps.network === true) {
    lines.push({ allowed: true, text: 'The internet' });
  }
  return lines;
}

/** One sentence for the install dialog's "It will be able to" box. */
export function permissionSummary(caps: PluginCapabilities | null | undefined): string | null {
  const lines = permissionLines(caps);
  if (!lines.length) return null;
  const can = lines.filter(line => line.allowed).map(line => line.text.toLowerCase());
  const cannot = lines.filter(line => !line.allowed).map(line => line.text.split('.')[0]);
  const parts: string[] = [];
  if (can.length) parts.push(`Read ${can.join(', ')}.`);
  if (cannot.length) parts.push(`It can't reach ${cannot.map(t => t.toLowerCase()).join(' or ')}.`);
  return parts.join(' ');
}

export type ReviewState = { label: string; tone: 'active' | 'warn' | 'default' };

export function reviewState(status: string | undefined): ReviewState {
  if (status === 'APPROVED') return { label: 'Live', tone: 'active' };
  if (status === 'PENDING') return { label: 'In review', tone: 'warn' };
  if (status === 'REJECTED') return { label: 'Changes asked', tone: 'default' };
  return { label: status ? status.toLowerCase() : 'Unknown', tone: 'default' };
}

/** Only approved plugins are listed in the marketplace catalog. */
export function visibilityLabel(status: string | undefined): string {
  return status === 'APPROVED' ? 'Marketplace' : 'Not listed';
}

export type CheckLine = { text: string; passed: boolean };

export function scanLines(scan: PluginScan | null | undefined): CheckLine[] {
  if (!scan || typeof scan.passed !== 'boolean') return [];
  const findings = scan.findings || [];
  if (!findings.length) {
    return [{ text: 'Static code scan', passed: scan.passed }];
  }
  return findings.map(text => ({ text, passed: false }));
}

/** Pulls `detail` out of a FastAPI error body. */
export function apiErrorText(error: unknown, fallback: string): string {
  const text = error instanceof Error ? error.message : '';
  try {
    const body = JSON.parse(text) as { detail?: unknown };
    if (typeof body.detail === 'string' && body.detail) return body.detail;
  } catch {
    // Plain text body.
  }
  return text || fallback;
}

export function errorStatus(error: unknown): number | undefined {
  return (error as { status?: number } | null)?.status;
}
