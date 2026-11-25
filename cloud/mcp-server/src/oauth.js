// OAuth 2.1 proxy for MCP clients. Google has no dynamic client registration, so this server is
// the authorization server: it registers clients, runs PKCE, signs in with Google (scopes
// openid email) and issues its own tokens. See README.md and the learnings for the why.
//
// Endpoints:
//   GET  /.well-known/oauth-protected-resource[/mcp]  RFC 9728 metadata
//   GET  /.well-known/oauth-authorization-server      RFC 8414 metadata
//   POST /oauth/register                              RFC 7591 dynamic client registration
//   GET  /oauth/authorize                             starts the Google sign-in
//   GET  /oauth/callback                              Google returns here, we issue a code
//   POST /oauth/token                                 authorization_code and refresh_token grants

import { signToken, verifyToken, pkceMatches } from './tokens.js';
import { emailAllowed, NOT_ALLOWED_MESSAGE } from './auth.js';
import {
  redirect, readForm, readJson, sendHtmlMessage, sendJson, sendOAuthError,
} from './http-util.js';

const ACCESS_TOKEN_SECONDS = 3600;
const REFRESH_TOKEN_SECONDS = 30 * 24 * 3600;
const CODE_SECONDS = 60;
const STATE_SECONDS = 600;
const MAX_REDIRECT_URIS = 10;

// Redirect URIs for registration: https, or http on the loopback address (Claude Code's callback).
export function isAllowedRedirectUri(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}

export function createOAuth({ cfg, key, exchangeGoogle, resolveUid, auth, log = () => {} }) {
  const issuer = cfg.publicBaseUrl;
  const googleCallback = `${issuer}/oauth/callback`;

  const issueTokens = (res, { uid, email, clientId }) => Promise.all([
    signToken(key, {
      typ: 'access',
      issuer,
      audience: cfg.resource,
      expiresInSeconds: ACCESS_TOKEN_SECONDS,
      claims: { sub: uid, email, email_verified: true },
    }),
    signToken(key, {
      typ: 'refresh',
      issuer,
      audience: issuer,
      expiresInSeconds: REFRESH_TOKEN_SECONDS,
      claims: { sub: uid, email, email_verified: true, client_id: clientId },
    }),
  ]).then(([accessToken, refreshToken]) => sendJson(res, 200, {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_SECONDS,
    refresh_token: refreshToken,
    scope: 'openid email',
  }, { 'cache-control': 'no-store', pragma: 'no-cache' }));

  async function verifyClient(clientId) {
    return verifyToken(key, clientId || '', { typ: 'client', issuer, audience: issuer });
  }

  async function register(req, res) {
    const body = await readJson(req, 16 * 1024);
    const uris = body.redirect_uris;
    if (!Array.isArray(uris) || uris.length === 0 || uris.length > MAX_REDIRECT_URIS) {
      return sendOAuthError(res, 400, 'invalid_redirect_uri', `redirect_uris must list 1 to ${MAX_REDIRECT_URIS} URIs`);
    }
    if (!uris.every((u) => typeof u === 'string' && isAllowedRedirectUri(u))) {
      return sendOAuthError(res, 400, 'invalid_redirect_uri', 'Redirect URIs must use https, or http on localhost');
    }
    const clientName = typeof body.client_name === 'string' ? body.client_name.slice(0, 100) : 'MCP client';
    const clientId = await signToken(key, {
      typ: 'client',
      issuer,
      audience: issuer,
      claims: { redirect_uris: uris, client_name: clientName },
    });
    return sendJson(res, 201, {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: clientName,
      redirect_uris: uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
  }

  async function authorize(req, res, url) {
    const p = url.searchParams;
    let client;
    try {
      client = await verifyClient(p.get('client_id'));
    } catch {
      return sendOAuthError(res, 400, 'invalid_client', 'Unknown client_id. Register the client again.');
    }
    const redirectUri = p.get('redirect_uri');
    if (!redirectUri || !client.redirect_uris.includes(redirectUri)) {
      return sendOAuthError(res, 400, 'invalid_request', 'redirect_uri is not registered for this client');
    }
    // From here on errors go back to the client's redirect URI, as OAuth requires.
    const state = p.get('state') || '';
    const backWithError = (error, description) => redirect(res, `${redirectUri}?${new URLSearchParams({
      error, error_description: description, ...(state ? { state } : {}),
    })}`);
    if (p.get('response_type') !== 'code') return backWithError('unsupported_response_type', 'Only response_type=code is supported');
    if (!p.get('code_challenge') || p.get('code_challenge_method') !== 'S256') {
      return backWithError('invalid_request', 'PKCE with code_challenge_method=S256 is required');
    }
    if (p.get('resource') && p.get('resource') !== cfg.resource) {
      return backWithError('invalid_target', `resource must be ${cfg.resource}`);
    }

    const stateToken = await signToken(key, {
      typ: 'state',
      issuer,
      audience: issuer,
      expiresInSeconds: STATE_SECONDS,
      claims: {
        client_id: p.get('client_id'),
        redirect_uri: redirectUri,
        state,
        code_challenge: p.get('code_challenge'),
      },
    });
    const google = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    google.search = new URLSearchParams({
      client_id: cfg.googleClientId,
      redirect_uri: googleCallback,
      response_type: 'code',
      scope: 'openid email',
      state: stateToken,
      prompt: 'select_account',
    }).toString();
    return redirect(res, google.toString());
  }

  async function callback(req, res, url) {
    const p = url.searchParams;
    let s;
    try {
      s = await verifyToken(key, p.get('state') || '', { typ: 'state', issuer, audience: issuer });
    } catch {
      return sendHtmlMessage(res, 400, 'Sign-in expired', 'This sign-in took too long or was already used. Start again from your MCP client.');
    }
    const backTo = (params) => redirect(res, `${s.redirect_uri}?${new URLSearchParams({
      ...params, ...(s.state ? { state: s.state } : {}),
    })}`);

    if (p.get('error')) return backTo({ error: 'access_denied', error_description: 'Google sign-in was cancelled' });
    if (!p.get('code')) return backTo({ error: 'invalid_request', error_description: 'Google returned no code' });

    let googleUser;
    try {
      googleUser = await exchangeGoogle({
        code: p.get('code'),
        redirectUri: googleCallback,
        clientId: cfg.googleClientId,
        clientSecret: cfg.googleClientSecret,
      });
    } catch (err) {
      log('google_exchange_failed', { reason: err.message });
      return backTo({ error: 'access_denied', error_description: 'Google sign-in could not be verified' });
    }
    if (!googleUser.email || !googleUser.emailVerified) {
      return sendHtmlMessage(res, 403, 'Email not verified', 'This Google account has no verified email address, so it cannot use this server.');
    }
    if (!emailAllowed(cfg, googleUser.email)) {
      log('login_refused_by_allowlist');
      return sendHtmlMessage(res, 403, 'Not allowed', NOT_ALLOWED_MESSAGE);
    }

    const uid = await resolveUid(auth, googleUser);
    const code = await signToken(key, {
      typ: 'code',
      issuer,
      audience: issuer,
      expiresInSeconds: CODE_SECONDS,
      claims: {
        uid,
        email: googleUser.email,
        client_id: s.client_id,
        redirect_uri: s.redirect_uri,
        code_challenge: s.code_challenge,
      },
    });
    return backTo({ code });
  }

  async function token(req, res) {
    const form = await readForm(req);
    if (form.grant_type === 'authorization_code') {
      let c;
      try {
        c = await verifyToken(key, form.code || '', { typ: 'code', issuer, audience: issuer });
      } catch {
        return sendOAuthError(res, 400, 'invalid_grant', 'Authorization code is invalid or expired');
      }
      if (c.client_id !== form.client_id || c.redirect_uri !== form.redirect_uri) {
        return sendOAuthError(res, 400, 'invalid_grant', 'client_id or redirect_uri does not match the code');
      }
      if (!pkceMatches(form.code_verifier, c.code_challenge)) {
        return sendOAuthError(res, 400, 'invalid_grant', 'PKCE verification failed');
      }
      return issueTokens(res, { uid: c.uid, email: c.email, clientId: c.client_id });
    }
    if (form.grant_type === 'refresh_token') {
      let r;
      try {
        r = await verifyToken(key, form.refresh_token || '', { typ: 'refresh', issuer, audience: issuer });
      } catch {
        return sendOAuthError(res, 400, 'invalid_grant', 'Refresh token is invalid or expired');
      }
      if (r.client_id !== form.client_id) {
        return sendOAuthError(res, 400, 'invalid_grant', 'client_id does not match the refresh token');
      }
      return issueTokens(res, { uid: r.sub, email: r.email, clientId: r.client_id });
    }
    return sendOAuthError(res, 400, 'unsupported_grant_type', 'Use authorization_code or refresh_token');
  }

  const protectedResourceMetadata = () => ({
    resource: cfg.resource,
    authorization_servers: [issuer],
    bearer_methods_supported: ['header'],
    scopes_supported: ['openid', 'email'],
    resource_name: 'Coffee Dial',
  });

  const authorizationServerMetadata = () => ({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['openid', 'email'],
  });

  // Returns true when the request was an OAuth or metadata request that this module answered.
  async function handle(req, res, url) {
    const { pathname } = url;
    const method = req.method;
    const cors = { 'access-control-allow-origin': '*' };

    if (method === 'GET' && (pathname === '/.well-known/oauth-protected-resource' || pathname === '/.well-known/oauth-protected-resource/mcp')) {
      sendJson(res, 200, protectedResourceMetadata(), cors);
      return true;
    }
    if (method === 'GET' && (pathname === '/.well-known/oauth-authorization-server' || pathname === '/.well-known/openid-configuration')) {
      sendJson(res, 200, authorizationServerMetadata(), cors);
      return true;
    }
    if (method === 'POST' && pathname === '/oauth/register') {
      await register(req, res);
      return true;
    }
    if (method === 'GET' && pathname === '/oauth/authorize') {
      await authorize(req, res, url);
      return true;
    }
    if (method === 'GET' && pathname === '/oauth/callback') {
      await callback(req, res, url);
      return true;
    }
    if (method === 'POST' && pathname === '/oauth/token') {
      await token(req, res);
      return true;
    }
    return false;
  }

  return { handle };
}
