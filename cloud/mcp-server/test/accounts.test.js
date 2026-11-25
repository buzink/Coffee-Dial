// Accounts: who may call the server, what an account without data sees, and the optional allowlist.

import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveUid } from '../src/identity.js';
import { NOT_ALLOWED_MESSAGE } from '../src/auth.js';
import {
  call, connectMcp, firebase, mintAccess, resetEmulators, seed, startApp, testConfig,
} from './helpers.js';

const openCfg = testConfig({ ALLOWED_EMAIL: '' });
const lockedCfg = testConfig({ ALLOWED_EMAIL: 'alice@example.com' });

let openApp;
let lockedApp;

before(async () => {
  openApp = await startApp(openCfg);
  lockedApp = await startApp(lockedCfg);
});
after(async () => {
  await openApp.close();
  await lockedApp.close();
});
beforeEach(resetEmulators);

describe('empty allowlist: every verified account may use the server', () => {
  it('a new account sees only its own, empty environment', async () => {
    const token = await mintAccess(openCfg, { uid: 'brand-new-uid', email: 'new@example.com' });
    const client = await connectMcp(openApp.url, token);
    try {
      for (const name of ['list_coffees', 'list_bags', 'list_brews', 'list_gear']) {
        const r = await call(client, name, {});
        assert.equal(r.isError, false, r.text);
        assert.equal(r.data.total, 0, `${name} must be empty for a new account`);
      }
      const analysis = await call(client, 'get_analysis', {});
      assert.equal(analysis.data.totals.brews, 0);
    } finally {
      await client.close();
    }
  });

  it('two accounts never see each other\'s data', async () => {
    await seed(openApp.db, 'alice-uid', 'coffeeTypes', 'a1', { roaster: 'Alice Roasters', name: 'Alice coffee', createdAt: '2026-01-01T00:00:00.000Z' });
    await seed(openApp.db, 'bob-uid', 'coffeeTypes', 'b1', { roaster: 'Bob Roasters', name: 'Bob coffee', createdAt: '2026-01-01T00:00:00.000Z' });
    const bob = await connectMcp(openApp.url, await mintAccess(openCfg, { uid: 'bob-uid', email: 'bob@example.com' }));
    try {
      const r = await call(bob, 'list_coffees', {});
      assert.deepEqual(r.data.items.map((c) => c.id), ['b1']);
    } finally {
      await bob.close();
    }
  });
});

describe('allowlist set: only ALLOWED_EMAIL gets in', () => {
  it('the allowed address works', async () => {
    const client = await connectMcp(lockedApp.url, await mintAccess(lockedCfg, { uid: 'alice-uid', email: 'alice@example.com' }));
    try {
      const r = await call(client, 'list_coffees', {});
      assert.equal(r.isError, false);
    } finally {
      await client.close();
    }
  });

  it('another address gets 403 with a clear message, not a tool result', async () => {
    const token = await mintAccess(lockedCfg, { uid: 'bob-uid', email: 'bob@example.com' });
    const res = await fetch(`${lockedApp.url}/mcp`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error_description, NOT_ALLOWED_MESSAGE);
  });
});

describe('bearer checks', () => {
  it('no token gets 401 and points the client at the protected-resource metadata', async () => {
    const res = await fetch(`${openApp.url}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 401);
    assert.match(res.headers.get('www-authenticate'), /resource_metadata=".*\/\.well-known\/oauth-protected-resource"/);
  });

  it('a garbage token gets 401', async () => {
    const res = await fetch(`${openApp.url}/mcp`, { method: 'POST', headers: { authorization: 'Bearer abc.def.ghi', 'content-type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 401);
  });

  it('a token for an unverified email gets 401', async () => {
    const token = await mintAccess(openCfg, { uid: 'x-uid', email: 'x@example.com', emailVerified: false });
    const res = await fetch(`${openApp.url}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 401);
  });
});

describe('mapping a Google account to the Firebase uid', () => {
  it('uses the Firebase user linked to this Google account', async () => {
    const { auth } = firebase();
    await auth.importUsers([{ uid: 'firebase-alice', email: 'alice@example.com', emailVerified: true, providerData: [{ providerId: 'google.com', uid: 'sub-alice', email: 'alice@example.com' }] }]);
    assert.equal(await resolveUid(auth, { sub: 'sub-alice', email: 'alice@example.com' }), 'firebase-alice');
  });

  it('falls back to a Firebase user with the same verified email', async () => {
    const { auth } = firebase();
    await auth.importUsers([{ uid: 'firebase-bob', email: 'bob@example.com', emailVerified: true }]);
    assert.equal(await resolveUid(auth, { sub: 'sub-bob', email: 'bob@example.com' }), 'firebase-bob');
  });

  it('does not trust an unverified Firebase email', async () => {
    const { auth } = firebase();
    await auth.importUsers([{ uid: 'squatter', email: 'victim@example.com', emailVerified: false }]);
    assert.equal(await resolveUid(auth, { sub: 'sub-victim', email: 'victim@example.com' }), 'google-sub-victim');
  });

  it('a Google account with no Firebase account gets its own empty namespace', async () => {
    const { auth } = firebase();
    assert.equal(await resolveUid(auth, { sub: '1234', email: 'nobody@example.com' }), 'google-1234');
  });
});
