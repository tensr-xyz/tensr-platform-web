import { getStytchBearerForTensrApi } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';

/**
 * Fire-and-forget ping of the Docker-backed assistant Lambda so the first
 * real chat turn is less likely to hit a cold-start 503.
 */
export function warmAssistantBackend(): void {
  if (typeof window === 'undefined') return;
  const token = getStytchBearerForTensrApi();
  if (!token) return;

  void fetch(tensrApiUrl('/assistant/capabilities'), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => {
    // Best-effort warm — ignore failures (auth race, network, cold 503).
  });
}
