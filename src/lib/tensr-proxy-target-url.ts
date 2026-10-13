import { isRemoteTensrApi } from '@/lib/tensr-api-url';

/**
 * Upstream URL for the Next.js /api/tensr proxy.
 *
 * Dataset list must stay on exact `/api/datasets` (auth zip). A trailing slash
 * can match Docker `/api/datasets/{proxy+}` and pay the container cold start.
 */
export function buildTensrProxyTargetUrl(
  pathSegments: string[],
  search: string,
  baseUrl: string
): string {
  const base = baseUrl.replace(/\/$/, '');
  const joined = pathSegments.filter(Boolean).join('/');
  const target = isRemoteTensrApi(base) ? `${base}/api/${joined}` : `${base}/${joined}`;
  return search ? `${target}${search}` : target;
}

const AGENT_LOOP_STREAMS = new Set([
  'assistant/agent-loop/stream',
  'assistant/agent-loop-v2/stream',
]);

/**
 * Upstream for the agent-loop SSE when `TENSR_ASSISTANT_STREAM_URL` (the API's
 * `AssistantStreamUrl` Function URL) is set. API Gateway HTTP APIs invoke Lambda
 * buffered, so on that path every progress event arrives at the end of the turn.
 */
export function buildAssistantStreamTargetUrl(
  pathSegments: string[],
  search: string,
  streamBaseUrl: string | undefined = process.env.TENSR_ASSISTANT_STREAM_URL
): string | null {
  const base = (streamBaseUrl || '').trim().replace(/\/+$/, '');
  if (!base) return null;
  const joined = pathSegments.filter(Boolean).join('/');
  if (!AGENT_LOOP_STREAMS.has(joined)) return null;
  return `${base}/api/${joined}${search}`;
}
