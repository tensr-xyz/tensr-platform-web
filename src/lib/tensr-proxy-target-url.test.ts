import {
  buildAssistantStreamTargetUrl,
  buildTensrProxyTargetUrl,
} from '@/lib/tensr-proxy-target-url';

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

  it('prefixes /api on a custom API host so chat does not 404 at /assistant', () => {
    const custom = 'https://api.tensr.example';
    expect(buildTensrProxyTargetUrl(['assistant', 'agent-loop', 'stream'], '', custom)).toBe(
      `${custom}/api/assistant/agent-loop/stream`
    );
  });
});

describe('buildAssistantStreamTargetUrl', () => {
  const FN_URL = 'https://abc123.lambda-url.us-east-1.on.aws/';

  it('sends the agent-loop stream to the Function URL', () => {
    expect(buildAssistantStreamTargetUrl(['assistant', 'agent-loop', 'stream'], '', FN_URL)).toBe(
      'https://abc123.lambda-url.us-east-1.on.aws/api/assistant/agent-loop/stream'
    );
  });

  it('keeps every other path on API Gateway', () => {
    expect(buildAssistantStreamTargetUrl(['assistant', 'agent-loop'], '', FN_URL)).toBeNull();
    expect(
      buildAssistantStreamTargetUrl(['datasets', 'abc', 'analyze', 'x', 'stream'], '', FN_URL)
    ).toBeNull();
    expect(
      buildAssistantStreamTargetUrl(['assistant', 'agent-loop', 'stream', 'x'], '', FN_URL)
    ).toBeNull();
  });

  it('falls back to API Gateway when the Function URL is not configured', () => {
    expect(buildAssistantStreamTargetUrl(['assistant', 'agent-loop', 'stream'], '', '')).toBeNull();
    expect(
      buildAssistantStreamTargetUrl(['assistant', 'agent-loop', 'stream'], '', undefined)
    ).toBeNull();
  });
});
