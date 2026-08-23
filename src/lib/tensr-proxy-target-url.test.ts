import { buildTensrProxyTargetUrl } from '@/lib/tensr-proxy-target-url';

const API = 'https://5qv9lg3s55.execute-api.us-east-1.amazonaws.com';

describe('buildTensrProxyTargetUrl', () => {
  it('sends dataset list to exact /api/datasets so API Gateway hits the auth zip', () => {
    expect(buildTensrProxyTargetUrl(['datasets'], '?scope=all', API)).toBe(
      `${API}/api/datasets?scope=all`
    );
  });

  it('does not add a trailing slash that can match Docker {proxy+}', () => {
    expect(buildTensrProxyTargetUrl(['datasets'], '', API)).toBe(`${API}/api/datasets`);
  });

  it('keeps dataset subpaths on /api/datasets/{id} for the Docker Lambda', () => {
    expect(buildTensrProxyTargetUrl(['datasets', 'abc', 'schema'], '', API)).toBe(
      `${API}/api/datasets/abc/schema`
    );
  });
});
