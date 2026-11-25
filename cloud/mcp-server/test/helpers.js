// Test helpers. Tests only run under the Firebase emulators (npm test). The guard below makes sure
// they can never reach the real project.

import assert from 'node:assert/strict';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { loadConfig } from '../src/config.js';
import { deriveSigningKey, signToken } from '../src/tokens.js';
import { createApp } from '../src/app.js';

assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Tests must run under the Firestore emulator: use npm test');
assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Tests must run under the Auth emulator: use npm test');

export const PROJECT_ID = 'demo-coffee-dial-mcp';
export const BASE_URL = 'http://127.0.0.1:8099';
export const GOOGLE_SECRET = 'test-google-secret-not-real';

export function testConfig(overrides = {}) {
  return loadConfig({
    PUBLIC_BASE_URL: BASE_URL,
    GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: GOOGLE_SECRET,
    FIRESTORE_PROJECT_ID: PROJECT_ID,
    ...overrides,
  });
}

export function firebase() {
  const app = getApps()[0] || initializeApp({ projectId: PROJECT_ID });
  return { db: getFirestore(app), auth: getAuth(app) };
}

export async function resetEmulators() {
  const fsHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  await fetch(`http://${fsHost}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${authHost}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
}

// Mints an access token the way the OAuth proxy does, for tests that skip the login.
export async function mintAccess(cfg, { uid, email, emailVerified = true }) {
  const key = deriveSigningKey(cfg.googleClientSecret);
  return signToken(key, {
    typ: 'access',
    issuer: cfg.publicBaseUrl,
    audience: cfg.resource,
    expiresInSeconds: 3600,
    claims: { sub: uid, email, email_verified: emailVerified },
  });
}

export async function connectMcp(baseUrl, token) {
  const client = new Client({ name: 'coffee-dial-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

// Calls a tool and returns { isError, text, data } so tests can check both outcomes.
export async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content?.[0]?.text ?? '';
  let data = null;
  if (!result.isError) data = JSON.parse(text);
  return { isError: !!result.isError, text, data };
}

export async function seed(db, uid, collection, id, data) {
  await db.collection('users').doc(uid).collection(collection).doc(id).set(data);
}

// Starts the real HTTP app on a free local port. The fake Google exchange maps a code to an account.
export async function startApp(cfg, { exchangeGoogle = fakeGoogle } = {}) {
  const { db, auth } = firebase();
  const app = createApp({ cfg, db, auth, exchangeGoogle, log: () => {} });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const { port } = app.address();
  return {
    db,
    auth,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => app.close(resolve)),
  };
}

// Stand-in for Google's token exchange: the "code" names the test account.
export const TEST_ACCOUNTS = {
  alice: { sub: 'google-sub-alice', email: 'alice@example.com', emailVerified: true },
  bob: { sub: 'google-sub-bob', email: 'bob@example.com', emailVerified: true },
  unverified: { sub: 'google-sub-unverified', email: 'unverified@example.com', emailVerified: false },
};

export async function fakeGoogle({ code }) {
  const account = TEST_ACCOUNTS[code];
  if (!account) throw new Error('unknown test code');
  return account;
}
