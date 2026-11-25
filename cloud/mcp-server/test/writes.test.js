// Write tools: dry runs, validation, single-source rules, beansLeft, the write limit and size limit.

import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { call, connectMcp, mintAccess, resetEmulators, seed, startApp, testConfig } from './helpers.js';

const cfg = testConfig();
const limitedCfg = testConfig({ MCP_WRITE_LIMIT_PER_HOUR: '2' });
const smallDocCfg = testConfig({ MCP_MAX_DOC_BYTES: '400' });

let app;
let limited;
let small;
let client;
let limitedClient;
let smallClient;

before(async () => {
  app = await startApp(cfg);
  limited = await startApp(limitedCfg);
  small = await startApp(smallDocCfg);
  client = await connectMcp(app.url, await mintAccess(cfg, { uid: 'writer-uid', email: 'writer@example.com' }));
  limitedClient = await connectMcp(limited.url, await mintAccess(limitedCfg, { uid: 'limited-uid', email: 'limited@example.com' }));
  smallClient = await connectMcp(small.url, await mintAccess(smallDocCfg, { uid: 'small-uid', email: 'small@example.com' }));
});
after(async () => {
  await client.close();
  await limitedClient.close();
  await smallClient.close();
  await app.close();
  await limited.close();
  await small.close();
});
beforeEach(resetEmulators);

const docs = async (uid, name) => (await app.db.collection('users').doc(uid).collection(name).get()).docs;

describe('dry run', () => {
  it('returns the proposed change and writes nothing', async () => {
    const r = await call(client, 'upsert_koffie', { roaster: 'Dry Roasters', name: 'Proposal' });
    assert.equal(r.isError, false, r.text);
    assert.equal(r.data.applied, false);
    assert.equal(r.data.action, 'create');
    assert.equal(r.data.document.roaster, 'Dry Roasters');
    assert.equal((await docs('writer-uid', 'coffeeTypes')).length, 0);
  });

  it('a dry run does not use up the write limit', async () => {
    for (let i = 0; i < 5; i += 1) {
      const r = await call(limitedClient, 'upsert_koffie', { roaster: `Dry ${i}`, apply: false });
      assert.equal(r.isError, false, r.text);
    }
    const applied = await call(limitedClient, 'upsert_koffie', { roaster: 'Real', apply: true });
    assert.equal(applied.isError, false, applied.text);
  });
});

describe('apply and update', () => {
  it('apply writes a new coffee under the user', async () => {
    const r = await call(client, 'upsert_koffie', { roaster: 'Applied', name: 'Blend', rating: 4, apply: true });
    assert.equal(r.isError, false, r.text);
    assert.equal(r.data.applied, true);
    const stored = (await docs('writer-uid', 'coffeeTypes'))[0].data();
    assert.equal(stored.roaster, 'Applied');
    assert.equal(stored.rating, 4);
    assert.equal(stored.uid, 'writer-uid');
    assert.equal(stored.decaf, false);
  });

  it('an update by id changes only the given fields and lists the changes', async () => {
    const created = await call(client, 'upsert_koffie', { roaster: 'Upd', name: 'Before', origin: 'Ethiopia', apply: true });
    const r = await call(client, 'upsert_koffie', { id: created.data.id, name: 'After', apply: true });
    assert.equal(r.isError, false, r.text);
    assert.deepEqual(r.data.changes, [{ field: 'name', from: 'Before', to: 'After' }]);
    const stored = (await docs('writer-uid', 'coffeeTypes')).find((d) => d.id === created.data.id).data();
    assert.equal(stored.origin, 'Ethiopia');
  });

  it('an update of an unknown id is refused', async () => {
    const r = await call(client, 'upsert_gear', { id: 'does-not-exist', name: 'X', apply: true });
    assert.equal(r.isError, true);
    assert.match(r.text, /No gear document/);
  });
});

describe('single source: each field lives on one entity', () => {
  it('a brew refuses coffee details and points to upsert_koffie', async () => {
    const r = await call(client, 'upsert_brew', { roaster: 'Copied', method: 'V60' });
    assert.equal(r.isError, true);
    assert.match(r.text, /does not belong on a brew/);
    assert.match(r.text, /upsert_koffie/);
  });

  it('a brew refuses a typed grinder and points to gearIds', async () => {
    const r = await call(client, 'upsert_brew', { grinder: 'Comandante', method: 'V60' });
    assert.equal(r.isError, true);
    assert.match(r.text, /gearIds/);
  });

  it('a bag refuses brew details and a copied origin', async () => {
    const brewField = await call(client, 'upsert_zak', { coffeeTypeId: 'x', weight: 15 });
    assert.match(brewField.text, /upsert_brew/);
    const originField = await call(client, 'upsert_zak', { coffeeTypeId: 'x', origin: 'Kenya' });
    assert.match(originField.text, /upsert_koffie/);
  });

  it('a coffee refuses bag details', async () => {
    const r = await call(client, 'upsert_koffie', { roaster: 'R', stock: 250 });
    assert.equal(r.isError, true);
    assert.match(r.text, /upsert_zak/);
  });

  it('beansLeft cannot be set by hand', async () => {
    const r = await call(client, 'upsert_zak', { coffeeTypeId: 'x', beansLeft: 10 });
    assert.match(r.text, /calculated/);
  });

  it('a brew must link to an existing bag and existing gear', async () => {
    const badBag = await call(client, 'upsert_brew', { beanId: 'missing-bag', apply: true });
    assert.match(badBag.text, /does not exist/);
    const badGear = await call(client, 'upsert_brew', { gearIds: ['missing-gear'], apply: true });
    assert.match(badGear.text, /gearIds not found/);
  });
});

describe('validation', () => {
  it('rejects out-of-range and wrongly typed values', async () => {
    assert.match((await call(client, 'upsert_koffie', { roaster: 'R', rating: 9 })).text, /rating/);
    assert.match((await call(client, 'upsert_brew', { rating: 2.5 })).text, /rating/);
    assert.match((await call(client, 'upsert_brew', { weight: -1 })).text, /weight/);
    assert.match((await call(client, 'upsert_koffie', { roaster: 'R', webshopUrl: 'http://shop.example' })).text, /https/);
    assert.match((await call(client, 'upsert_zak', { coffeeTypeId: 'x', openedDate: 'not a date' })).text, /date/);
  });

  it('a coffee needs a name or a roaster', async () => {
    const r = await call(client, 'upsert_koffie', { origin: 'Brazil' });
    assert.equal(r.isError, true);
    assert.match(r.text, /name or a roaster/);
  });

  it('a bag needs an existing coffee', async () => {
    const none = await call(client, 'upsert_zak', { stock: 100 });
    assert.match(none.text, /coffeeTypeId/);
    const missing = await call(client, 'upsert_zak', { coffeeTypeId: 'nope', stock: 100 });
    assert.match(missing.text, /does not exist/);
  });
});

describe('beansLeft follows the brews', () => {
  it('stock minus the brew weights, recalculated when a brew is applied', async () => {
    const coffee = await call(client, 'upsert_koffie', { roaster: 'Stock', name: 'Tracked', apply: true });
    const bag = await call(client, 'upsert_zak', { coffeeTypeId: coffee.data.id, stock: 250, apply: true });
    assert.equal(bag.data.document.beansLeft, 250);

    const brew = await call(client, 'upsert_brew', { beanId: bag.data.id, method: 'V60', weight: 15, apply: true });
    assert.equal(brew.isError, false, brew.text);
    const stored = (await docs('writer-uid', 'beans')).find((d) => d.id === bag.data.id).data();
    assert.equal(stored.beansLeft, 235);

    const dry = await call(client, 'upsert_brew', { beanId: bag.data.id, weight: 20, apply: false });
    assert.equal(dry.data.sideEffects.length, 1);
    const stillOld = (await docs('writer-uid', 'beans')).find((d) => d.id === bag.data.id).data();
    assert.equal(stillOld.beansLeft, 235, 'a dry run must not change the bag');
  });
});

describe('write limit and document size', () => {
  it('stops applied writes after MCP_WRITE_LIMIT_PER_HOUR', async () => {
    assert.equal((await call(limitedClient, 'upsert_gear', { name: 'One', apply: true })).isError, false);
    assert.equal((await call(limitedClient, 'upsert_gear', { name: 'Two', apply: true })).isError, false);
    const third = await call(limitedClient, 'upsert_gear', { name: 'Three', apply: true });
    assert.equal(third.isError, true);
    assert.match(third.text, /Write limit reached/);
    const stored = await limited.db.collection('users').doc('limited-uid').collection('gear').get();
    assert.equal(stored.size, 2, 'the refused write must not be stored');
  });

  it('refuses a document over MCP_MAX_DOC_BYTES', async () => {
    const r = await call(smallClient, 'upsert_brew', { notes: 'x'.repeat(600), apply: true });
    assert.equal(r.isError, true);
    assert.match(r.text, /limit is 400/);
  });

  it('a brew can link gear that already exists', async () => {
    await seed(app.db, 'writer-uid', 'gear', 'g1', { name: 'Kept', type: 'grinder', createdAt: '2026-01-01T00:00:00.000Z' });
    const r = await call(client, 'upsert_brew', { gearIds: ['g1'], method: 'V60', apply: true });
    assert.equal(r.isError, false, r.text);
  });
});
