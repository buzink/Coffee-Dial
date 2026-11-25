// Bearer-token check for every /mcp call, and the optional allowlist.
// The access token is our own signed JWT (see tokens.js). Its email claim is only set after
// Google confirmed a verified email, so accepting it here is the verified-account check.

import { verifyToken } from './tokens.js';
import { AuthError } from './errors.js';

export const NOT_ALLOWED_MESSAGE = 'This Google account is not allowed to use this Coffee Dial MCP server.';

// No allowlist configured: every verified account is accepted. Otherwise only ALLOWED_EMAIL.
export function emailAllowed(cfg, email) {
  if (!cfg.allowedEmail) return true;
  return String(email || '').trim().toLowerCase() === cfg.allowedEmail;
}

export async function authenticate(req, { cfg, key }) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
  if (!match) throw new AuthError(401, 'Missing bearer token', 'invalid_request');

  let claims;
  try {
    claims = await verifyToken(key, match[1], {
      typ: 'access',
      issuer: cfg.publicBaseUrl,
      audience: cfg.resource,
    });
  } catch {
    throw new AuthError(401, 'Access token is invalid or expired');
  }

  if (claims.email_verified !== true || !claims.sub || !claims.email) {
    throw new AuthError(401, 'Access token has no verified Google account');
  }
  if (!emailAllowed(cfg, claims.email)) {
    throw new AuthError(403, NOT_ALLOWED_MESSAGE, 'forbidden');
  }
  return { uid: String(claims.sub), email: String(claims.email) };
}
