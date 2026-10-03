import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';

const statePath = path.join(__dirname, '.auth', 'state.json');
const SANDBOX_EMAIL = 'sandbox@stytch.com';
const SANDBOX_CODE = '000000';
const SESSION_MINUTES = 7 * 24 * 60;

type StytchErrorBody = { error_type?: string; error_message?: string };

/**
 * Live setup mints a Stytch test-environment session with the sandbox OTP.
 * It does not open the login page. Missing project credentials skip the suite.
 * A present secret that Stytch rejects fails the run.
 */
export default async function globalSetup(config: FullConfig) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  loadCredentialFiles();

  const projectId = process.env.STYTCH_PROJECT_ID?.trim();
  const secret = process.env.STYTCH_SECRET?.trim();
  if (!projectId || !secret) {
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        cookies: [],
        origins: [],
        skipped: 'missing STYTCH_PROJECT_ID or STYTCH_SECRET',
      })
    );
    return;
  }

  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) throw new Error('playwright.live.config.ts needs a baseURL');

  const session = await mintSandboxSession(projectId, secret);
  fs.writeFileSync(statePath, JSON.stringify(storageState(baseURL, session)));
}

function loadCredentialFiles() {
  const candidates = [
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(__dirname, '../../../tensr-api/.env'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/^\s*(STYTCH_PROJECT_ID|STYTCH_SECRET)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      const value = match[2].replace(/^['"]|['"]$/g, '').trim();
      if (value) process.env[match[1]] = value;
    }
  }
}

async function mintSandboxSession(
  projectId: string,
  secret: string
): Promise<{ session_token: string; session_jwt: string }> {
  const authorization = `Basic ${Buffer.from(`${projectId}:${secret}`).toString('base64')}`;
  const created = await stytchPost('/v1/otps/email/login_or_create', authorization, {
    email: SANDBOX_EMAIL,
  });
  const emailId = stringField(created, 'email_id');
  if (!emailId) throw new Error('Stytch login_or_create did not return email_id');

  const authed = await stytchPost('/v1/otps/authenticate', authorization, {
    method_id: emailId,
    code: SANDBOX_CODE,
    session_duration_minutes: SESSION_MINUTES,
  });
  const sessionToken = stringField(authed, 'session_token');
  const sessionJwt = stringField(authed, 'session_jwt');
  if (!sessionToken || !sessionJwt) {
    throw new Error('Stytch authenticate did not return a session');
  }
  return { session_token: sessionToken, session_jwt: sessionJwt };
}

async function stytchPost(
  pathname: string,
  authorization: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://test.stytch.com${pathname}`, {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as StytchErrorBody &
    Record<string, unknown>;
  if (!response.ok) {
    const kind = payload.error_type || 'unknown';
    throw new Error(`Stytch ${pathname} failed (${response.status} ${kind})`);
  }
  return payload;
}

function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value : '';
}

function storageState(baseURL: string, session: { session_token: string; session_jwt: string }) {
  const url = new URL(baseURL);
  const expires = Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60;
  const cookies = [
    ['stytch_session_token', session.session_token],
    ['stytch_session_jwt', session.session_jwt],
  ].map(([name, value]) => ({
    name,
    value,
    domain: url.hostname,
    path: '/',
    expires,
    httpOnly: false,
    secure: url.protocol === 'https:',
    sameSite: 'Lax' as const,
  }));
  return {
    cookies,
    origins: [
      {
        origin: url.origin,
        localStorage: [
          { name: 'stytch_session_token', value: session.session_token },
          { name: 'stytch_session_jwt', value: session.session_jwt },
        ],
      },
    ],
  };
}
