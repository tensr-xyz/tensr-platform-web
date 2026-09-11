import { isRemoteTensrApi, tensrApiUrl } from '@/lib/tensr-api-url';

const EXECUTE_API = 'https://5qv9lg3s55.execute-api.us-east-1.amazonaws.com';
const CUSTOM_API = 'https://api.tensr.example';
const LOCAL = 'http://127.0.0.1:8000';

describe('isRemoteTensrApi', () => {
  it('treats API Gateway execute-api hosts as remote', () => {
    expect(isRemoteTensrApi(EXECUTE_API)).toBe(true);
  });

  it('treats a custom HTTPS API host as remote, not as local uvicorn', () => {
    expect(isRemoteTensrApi(CUSTOM_API)).toBe(true);
  });

  it('treats localhost uvicorn as local', () => {
    expect(isRemoteTensrApi(LOCAL)).toBe(false);
    expect(isRemoteTensrApi('http://localhost:8000')).toBe(false);
  });
});

describe('tensrApiUrl', () => {
  it('sends browser chat to the same-origin proxy for execute-api', () => {
    expect(tensrApiUrl('/assistant/agent-loop/stream', EXECUTE_API)).toBe(
      '/api/tensr/assistant/agent-loop/stream'
    );
  });

  it('sends browser chat to the same-origin proxy for a custom API host', () => {
    expect(tensrApiUrl('/assistant/agent-loop/stream', CUSTOM_API)).toBe(
      '/api/tensr/assistant/agent-loop/stream'
    );
  });

  it('keeps local uvicorn on /assistant without an /api prefix', () => {
    expect(tensrApiUrl('/assistant/agent-loop/stream', LOCAL)).toBe(
      `${LOCAL}/assistant/agent-loop/stream`
    );
  });
});
