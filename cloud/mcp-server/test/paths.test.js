// A tool must never touch a path outside users/{uid}.

import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { ValidationError } from '../src/errors.js';
import {
  call, connectMcp, firebase, mintAccess, resetEmulators, seed, startApp, testConfig,
} from './helpers.js';

const cfg = testConfig();
let app;
let db;

before(async () => {
  app = await startApp(cfg);
  db = app.db;
});
after(async () => app.close());
beforeEach(resetEmulators);

// Every document in the emulator, as "path" strings.
async function allDocPaths() {
  const out = [];
  const roots = await db.listCollections();
  // listDocuments also returns documents that only exist as parents of subcollections.
  const walk = async (ref) => {
    for (const doc of await ref.listDocuments()) {
      out.push(doc.path);
      for (const sub of await doc.listCollections()) await walk(sub);
    }
  };
  for (const root of roots) await walk(root);
  return { roots: roots.map((r) => r.id).sort(), paths: out.sort() };
}

describe('path isolation', () => {
  it('every write and read by one user stays under users/{uid}', async () => {
    const aliceToken = await mintAccess(cfg, { uid: 'alice-uid', email: 'alice@example.com' });
    await seed(db, 'bob-uid', 'coffeeTypes', 'bobCoffee', { roaster: 'Bob Roasters', name: 'Secret', createdAt: '2026-01-01T00:00:00.000Z' });
    const before = await allDocPaths();

    const alice = await connectMcp(app.url, aliceToken);
    try {
      const coffee = await call(alice, 'upsert_coffee', { roaster: 'Alice Roasters', name: 'Blend', apply: true });
      assert.equal(coffee.isError, false, coffee.text);
      const bag = await call(alice, 'upsert_bag', { coffeeTypeId: coffee.data.id, stock: 250, apply: true });
      assert.equal(bag.isError, false, bag.text);
      const gear = await call(alice, 'upsert_gear', { name: 'Hand grinder', type: 'grinder', apply: true });
      assert.equal(gear.isError, false, gear.text);
      const brew = await call(alice, 'upsert_brew', { beanId: bag.data.id, gearIds: [gear.data.id], method: 'V60', weight: 15, apply: true });
      assert.equal(brew.isError, false, brew.text);
      for (const name of ['list_coffees', 'list_bags', 'list_brews', 'list_gear', 'get_analysis']) {
        const r = await call(alice, name, {});
        assert.equal(r.isError, false, `${name}: ${r.text}`);
      }
    } finally {
      await alice.close();
    }

    const after = await allDocPaths();
    assert.deepEqual(after.roots, ['users'], 'no collection outside users/ may exist');
    for (const path of after.paths) {
      assert.match(path, /^users\/(alice-uid|bob-uid)(\/|$)/, `path outside a user tree: ${path}`);
    }
    const bobBefore = before.paths.filter((p) => p.startsWith('users/bob-uid'));
    const bobAfter = after.paths.filter((p) => p.startsWith('users/bob-uid'));
    assert.deepEqual(bobAfter, bobBefore, 'bob\'s data must be untouched');
    assert.ok(after.paths.some((p) => p.startsWith('users/alice-uid/coffees/')), 'alice wrote her brew under her own tree');
  });

  it('a tool refuses a uid argument: the user comes only from the token', async () => {
    const token = await mintAccess(cfg, { uid: 'alice-uid', email: 'alice@example.com' });
    const client = await connectMcp(app.url, token);
    try {
      const r = await call(client, 'upsert_coffee', { uid: 'bob-uid', roaster: 'X', apply: true });
      assert.equal(r.isError, true);
      assert.match(r.text, /Unknown field "uid"/);
      const coffees = await call(client, 'list_coffees', {});
      assert.equal(coffees.data.total, 0);
    } finally {
      await client.close();
    }
  });
});

describe('Store (the only path builder)', () => {
  const { db: localDb } = firebase();

  it('refuses a uid that could escape users/', () => {
    assert.throws(() => new Store(localDb, '../other'));
    assert.throws(() => new Store(localDb, 'a/b'));
    assert.throws(() => new Store(localDb, ''));
  });

  it('refuses collections outside the user subtree', () => {
    const store = new Store(localDb, 'alice-uid');
    assert.throws(() => store.collection('photos'), /not allowed/);
    assert.throws(() => store.collection('publicProfiles'), /not allowed/);
    assert.equal(store.collection('coffees').path, 'users/alice-uid/coffees');
  });

  it('refuses document ids that contain a slash', () => {
    const store = new Store(localDb, 'alice-uid');
    assert.throws(() => store.doc('coffeeTypes', '../../users/bob-uid'), ValidationError);
  });
});
