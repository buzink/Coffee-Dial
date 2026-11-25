// Google sign-in and the mapping from a Google account to the Firebase uid that owns the data.
//
// The app stores data under the Firebase Auth uid, which is not the Google `sub`. So the uid is
// looked up in Firebase Auth:
//   1. a Firebase user that is linked to this Google account (provider google.com, uid = sub);
//   2. otherwise a Firebase user with the same email, but only if Firebase marks it verified;
//   3. otherwise a new, empty namespace `google-<sub>`. That account sees an empty environment.

import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

// Exchanges the Google authorization code for an id token and verifies it. Returns the claims we use.
export async function exchangeGoogleCode({ code, redirectUri, clientId, clientSecret }) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) throw new Error(`Google token exchange failed with status ${response.status}`);
  const body = await response.json();
  const { payload } = await jwtVerify(body.id_token, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: clientId,
  });
  return {
    sub: String(payload.sub || ''),
    email: String(payload.email || '').trim().toLowerCase(),
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
  };
}

const isNotFound = (err) => err?.code === 'auth/user-not-found';

export async function resolveUid(auth, { sub, email }) {
  try {
    return (await auth.getUserByProviderUid('google.com', sub)).uid;
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }
  if (email) {
    try {
      const user = await auth.getUserByEmail(email);
      if (user.emailVerified) return user.uid;
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
  }
  return `google-${sub}`;
}
