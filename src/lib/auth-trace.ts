const TRACE_KEY = 'tensr_auth_trace_v1';
const MAX_ENTRIES = 200;

export type AuthTraceEntry = {
  t: number;
  iso: string;
  event: string;
  path: string;
  detail?: Record<string, unknown>;
};

function readTrace(): AuthTraceEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(TRACE_KEY);
    return raw ? (JSON.parse(raw) as AuthTraceEntry[]) : [];
  } catch {
    return [];
  }
}

function writeTrace(entries: AuthTraceEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(TRACE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* quota */
  }
}

/** Append an auth lifecycle event (survives redirect to /login). */
export function authTrace(event: string, detail?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  const entry: AuthTraceEntry = {
    t: Date.now(),
    iso: new Date().toISOString(),
    event,
    path: window.location.pathname + window.location.search,
    detail,
  };

  const next = readTrace();
  next.push(entry);
  writeTrace(next);

  if (process.env.NODE_ENV === 'development') {
    console.log('[auth-trace]', event, detail ?? '');
  }
}

export function getAuthTrace(): AuthTraceEntry[] {
  return readTrace();
}

export function clearAuthTrace(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TRACE_KEY);
}

/** Print buffered trace to console (call from /login or devtools). */
export function dumpAuthTrace(label = 'Auth trace'): void {
  const entries = getAuthTrace();
  console.group(label);
  for (const e of entries) {
    console.log(e.iso, e.event, e.path, e.detail ?? '');
  }
  console.groupEnd();
}

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as unknown as { dumpAuthTrace?: typeof dumpAuthTrace }).dumpAuthTrace = dumpAuthTrace;
}
