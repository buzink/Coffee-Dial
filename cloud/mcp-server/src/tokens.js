// Signed tokens for the OAuth proxy. Everything the proxy issues (client ids, authorization codes,
// access and refresh tokens) is a JWT signed with one HMAC key, so any Cloud Run instance can
// verify it without shared storage. The key is derived from the Google client secret with HKDF,
// so no extra secret is needed. See README.md for the trade-offs (no revocation list).

import { createHash, createSecretKey, hkdfSync, randomUUID, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const KEY_INFO = 'coffee-dial-mcp oauth proxy v1';

export function deriveSigningKey(googleClientSecret) {
  if (!googleClientSecret) throw new Error('GOOGLE_CLIENT_SECRET is not set');
  const bytes = hkdfSync('sha256', Buffer.from(googleClientSecret), Buffer.alloc(0), KEY_INFO, 32);
  return createSecretKey(Buffer.from(bytes));
}

// typ tells the token kinds apart, so an access token cannot be used as a code, and so on.
export async function signToken(key, { typ, issuer, audience, expiresInSeconds = 0, claims = {} }) {
  let jwt = new SignJWT({ ...claims, typ })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setJti(randomUUID());
  if (expiresInSeconds > 0) jwt = jwt.setExpirationTime(`${expiresInSeconds}s`);
  return jwt.sign(key);
}

export async function verifyToken(key, token, { typ, issuer, audience }) {
  const { payload } = await jwtVerify(token, key, { issuer, audience, algorithms: ['HS256'] });
  if (payload.typ !== typ) throw new Error(`Expected a ${typ} token`);
  return payload;
}

// PKCE (RFC 7636) with S256 only. The verifier must be 43 to 128 characters.
export function pkceMatches(verifier, challenge) {
  if (typeof verifier !== 'string' || verifier.length < 43 || verifier.length > 128) return false;
  if (typeof challenge !== 'string' || !challenge) return false;
  const computed = createHash('sha256').update(verifier).digest('base64url');
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}
