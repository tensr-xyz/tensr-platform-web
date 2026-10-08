/** Retry a cold Lambda 502/503/504 instead of showing the gateway JSON. */

const listeners = new Set<() => void>();

export function subscribeDatasetColdStart(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyColdStart(): void {
  listeners.forEach(listener => listener());
}

export function isColdStartStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

export async function fetchWithColdStartRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { attempts?: number; delaysMs?: number[] }
): Promise<Response> {
  const attempts = options?.attempts ?? 4;
  const delays = options?.delaysMs ?? [400, 800, 1600];
  let last: Response | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(input, init);
    if (!isColdStartStatus(response.status)) return response;
    last = response;
    if (attempt === attempts - 1) break;
    notifyColdStart();
    const wait = delays[Math.min(attempt, delays.length - 1)] ?? 0;
    if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
  return last as Response;
}
