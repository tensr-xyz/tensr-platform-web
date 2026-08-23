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
