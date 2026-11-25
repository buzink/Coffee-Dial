// OAuth 2.1 proxy: metadata, dynamic registration, PKCE login with a stand-in Google, token and refresh.

import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { call, connectMcp, resetEmulators, startApp, testConfig, BASE_URL } from './helpers.js';

const cfg = testConfig();
const lockedCfg = testConfig({ ALLOWED_EMAIL: 'alice@example.com' });
const REDIRECT = 'http://127.0.0.1:33418/callback';

let app;
let locked;

before(async () => {
  app = await startApp(cfg);
  locked = await startApp(lockedCfg);
});
after(async () => {
  await app.close();
  await locked.close();
});
beforeEach(resetEmulators);

const pkce = () => {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
};

async function register(url, redirectUris = [REDIRECT]) {
  return fetch(`${url}/oauth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_name: 'Claude Code', redirect_uris: redirectUris }),
  });
}

async function authorize(url, clientId, challenge, extra = {}) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT,
    state: 'client-state-123',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...extra,
  });
  return fetch(`${url}/oauth/authorize?${params}`, { redirect: 'manual' });
}

// Runs the Google leg: the callback gets the Google code and our signed state.
async function googleLeg(url, authorizeResponse, googleCode) {
  const google = new URL(authorizeResponse.headers.get('location'));
  assert.equal(google.origin, 'https://accounts.google.com');
  assert.equal(google.searchParams.get('scope'), 'openid email');
  const state = google.searchParams.get('state');
  return fetch(`${url}/oauth/callback?${new URLSearchParams({ code: googleCode, state })}`, { redirect: 'manual' });
}

async function exchange(url, form) {
  return fetch(`${url}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  });
}

describe('metadata', () => {
  it('protected resource metadata names the MCP endpoint and this server as authorization server', async () => {
    const res = await fetch(`${app.url}/.well-known/oauth-protected-resource`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.resource, `${BASE_URL}/mcp`);
    assert.deepEqual(body.authorization_servers, [BASE_URL]);
    assert.deepEqual(body.bearer_methods_supported, ['header']);

    const suffixed = await (await fetch(`${app.url}/.well-known/oauth-protected-resource/mcp`)).json();
    assert.equal(suffixed.resource, body.resource);
  });

  it('authorization server metadata advertises PKCE S256 and the endpoints', async () => {
    const body = await (await fetch(`${app.url}/.well-known/oauth-authorization-server`)).json();
    assert.equal(body.issuer, BASE_URL);
    assert.deepEqual(body.code_challenge_methods_supported, ['S256']);
    assert.equal(body.authorization_endpoint, `${BASE_URL}/oauth/authorize`);
    assert.equal(body.token_endpoint, `${BASE_URL}/oauth/token`);
    assert.equal(body.registration_endpoint, `${BASE_URL}/oauth/register`);
  });
});

describe('registration', () => {
  it('accepts https and loopback redirect URIs', async () => {
    const res = await register(app.url, ['https://claude.ai/api/mcp/auth_callback', 'http://localhost:1234/cb']);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.client_id);
    assert.equal(body.token_endpoint_auth_method, 'none');
  });

  it('refuses plain http redirect URIs that are not loopback', async () => {
    const res = await register(app.url, ['http://evil.example/cb']);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'invalid_redirect_uri');
  });
});

describe('login and tokens', () => {
  it('runs authorize, Google, code and token, then serves an MCP call as the account', async () => {
    const { client_id: clientId } = await (await register(app.url)).json();
    const { verifier, challenge } = pkce();

    const authz = await authorize(app.url, clientId, challenge);
    assert.equal(authz.status, 302);
    const callback = await googleLeg(app.url, authz, 'alice');
    assert.equal(callback.status, 302);
    const back = new URL(callback.headers.get('location'));
    assert.equal(`${back.origin}${back.pathname}`, REDIRECT);
    assert.equal(back.searchParams.get('state'), 'client-state-123', 'the client state comes back untouched');
    const code = back.searchParams.get('code');

    const tokenRes = await exchange(app.url, {
      grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: REDIRECT, code_verifier: verifier,
    });
    assert.equal(tokenRes.status, 200);
    const tokens = await tokenRes.json();
    assert.equal(tokens.token_type, 'Bearer');
    assert.ok(tokens.refresh_token);

    const client = await connectMcp(app.url, tokens.access_token);
    try {
      const r = await call(client, 'list_coffees', {});
      assert.equal(r.isError, false, r.text);
      assert.equal(r.data.total, 0, 'an account with no Firebase data gets an empty environment');
    } finally {
      await client.close();
    }

    const refreshed = await exchange(app.url, { grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId });
    assert.equal(refreshed.status, 200);
    assert.ok((await refreshed.json()).access_token);
  });

  it('a wrong PKCE verifier gets no token', async () => {
    const { client_id: clientId } = await (await register(app.url)).json();
    const { challenge } = pkce();
    const authz = await authorize(app.url, clientId, challenge);
    const callback = await googleLeg(app.url, authz, 'alice');
    const code = new URL(callback.headers.get('location')).searchParams.get('code');
    const res = await exchange(app.url, {
      grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: REDIRECT, code_verifier: randomBytes(32).toString('base64url'),
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'invalid_grant');
  });

  it('authorize without PKCE is refused back to the client', async () => {
    const { client_id: clientId } = await (await register(app.url)).json();
    const params = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, state: 's' });
    const res = await fetch(`${app.url}/oauth/authorize?${params}`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location'), /error=invalid_request/);
  });

  it('an unregistered redirect URI is refused without redirecting', async () => {
    const { client_id: clientId } = await (await register(app.url)).json();
    const res = await authorize(app.url, clientId, pkce().challenge, { redirect_uri: 'http://127.0.0.1:1/other' });
    assert.equal(res.status, 400);
  });

  it('a Google account without a verified email gets no code', async () => {
    const { client_id: clientId } = await (await register(app.url)).json();
    const authz = await authorize(app.url, clientId, pkce().challenge);
    const callback = await googleLeg(app.url, authz, 'unverified');
    assert.equal(callback.status, 403);
    assert.equal(callback.headers.get('location'), null);
  });

  it('with ALLOWED_EMAIL set to several addresses, each listed one gets in', async () => {
    const multi = testConfig({ ALLOWED_EMAIL: 'alice@example.com, bob@example.com' });
    assert.deepEqual(multi.allowedEmails, ['alice@example.com', 'bob@example.com']);
    const multiApp = await startApp(multi);
    try {
      const { client_id: clientId } = await (await register(multiApp.url)).json();
      const authz = await authorize(multiApp.url, clientId, pkce().challenge);
      const callback = await googleLeg(multiApp.url, authz, 'bob');
      assert.equal(callback.status, 302, 'bob is on the list');
    } finally {
      await multiApp.close();
    }
  });

  it('with ALLOWED_EMAIL set, another account is refused at login with a clear message', async () => {
    const { client_id: clientId } = await (await register(locked.url)).json();
    const authz = await authorize(locked.url, clientId, pkce().challenge);
    const callback = await googleLeg(locked.url, authz, 'bob');
    assert.equal(callback.status, 403);
    const html = await callback.text();
    assert.match(html, /not allowed/);
    assert.equal(callback.headers.get('location'), null);
  });

  it('a forged state token is refused', async () => {
    const res = await fetch(`${app.url}/oauth/callback?code=alice&state=not-a-token`, { redirect: 'manual' });
    assert.equal(res.status, 400);
  });
});
