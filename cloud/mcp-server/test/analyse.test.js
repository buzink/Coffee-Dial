// Reads: list rows, the analysis summary computed on the server, and brew graphs on request.

import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { call, connectMcp, mintAccess, resetEmulators, seed, startApp, testConfig } from './helpers.js';

const cfg = testConfig();
const tinyGraphCfg = testConfig({ MCP_MAX_GRAPH_BYTES: '50' });
const UID = 'reader-uid';
const T = (day) => `2026-11-${String(day).padStart(2, '0')}T08:00:00.000Z`;

let app;
let tiny;
let client;

async function seedLibrary(db) {
  await seed(db, UID, 'coffeeTypes', 'c1', { roaster: 'Roast Lab', name: 'Ethiopia Yirgacheffe', origin: 'Ethiopia', createdAt: T(1) });
  await seed(db, UID, 'coffeeTypes', 'c2', { roaster: 'Mountain Co', name: 'Colombia', origin: 'Colombia', createdAt: T(2) });
  await seed(db, UID, 'beans', 'b1', { coffeeTypeId: 'c1', stock: 250, archived: false, createdAt: T(1) });
  await seed(db, UID, 'beans', 'b2', { coffeeTypeId: 'c2', stock: 500, archived: true, createdAt: T(2) });
  await seed(db, UID, 'gear', 'g1', { name: 'Hand grinder', type: 'grinder', createdAt: T(1) });
  await seed(db, UID, 'coffees', 'k1', { beanId: 'b1', method: 'V60', weight: 15, rating: 4, gearIds: ['g1'], createdAt: T(3) });
  await seed(db, UID, 'coffees', 'k2', { beanId: 'b1', method: 'V60', weight: 15, rating: 5, createdAt: T(4) });
  await seed(db, UID, 'coffees', 'k3', { beanId: 'b1', method: 'Espresso', weight: 18, rating: 3, createdAt: T(5) });
  await seed(db, UID, 'coffees', 'k4', { beanId: 'b2', method: 'V60', weight: 15, rating: 0, createdAt: T(6) });
  await seed(db, UID, 'brewGraphs', 'k1', { points: Array.from({ length: 40 }, (_, i) => i) });
}

before(async () => {
  app = await startApp(cfg);
  tiny = await startApp(tinyGraphCfg);
  client = await connectMcp(app.url, await mintAccess(cfg, { uid: UID, email: 'reader@example.com' }));
});
after(async () => {
  await client.close();
  await app.close();
  await tiny.close();
});
beforeEach(async () => {
  await resetEmulators();
  await seedLibrary(app.db);
});

describe('get_analysis', () => {
  it('counts and averages are computed on the server', async () => {
    const r = await call(client, 'get_analysis', {});
    assert.equal(r.isError, false, r.text);
    const { totals, byMethod, byBag } = r.data;
    assert.equal(totals.coffees, 2);
    assert.equal(totals.bags, 2);
    assert.equal(totals.bagsArchived, 1);
    assert.equal(totals.brews, 4);
    assert.equal(totals.brewsWithoutBag, 0);
    assert.equal(totals.rated, 3, 'an unrated brew is not counted as rated');
    assert.equal(totals.averageRating, 4);

    const v60 = byMethod.items.find((m) => m.key === 'V60');
    assert.equal(v60.brews, 3);
    assert.equal(v60.rated, 2);
    assert.equal(v60.averageRating, 4.5);
    assert.equal(byMethod.items.find((m) => m.key === 'Espresso').averageRating, 3);

    const bag1 = byBag.items.find((b) => b.key === 'b1');
    assert.equal(bag1.label, 'Roast Lab Ethiopia Yirgacheffe');
    assert.equal(bag1.brews, 3);
    assert.equal(bag1.averageRating, 4);
  });
});

describe('list tools', () => {
  it('list_brews returns the newest first and filters by method', async () => {
    const all = await call(client, 'list_brews', {});
    assert.deepEqual(all.data.items.map((b) => b.id), ['k4', 'k3', 'k2', 'k1']);
    const v60 = await call(client, 'list_brews', { method: 'v60', limit: 2 });
    assert.deepEqual(v60.data.items.map((b) => b.id), ['k4', 'k2']);
    assert.equal(v60.data.total, 3);
    assert.equal(v60.data.truncated, true);
    assert.equal(all.data.items[3].gear.length, 1);
    assert.equal(all.data.items[3].gear[0].name, 'Hand grinder');
    assert.equal(all.data.items[3].coffee, 'Roast Lab Ethiopia Yirgacheffe');
  });

  it('list_bags can hide archived bags and carries the coffee label', async () => {
    const r = await call(client, 'list_bags', { includeArchived: false });
    assert.equal(r.data.total, 1);
    assert.equal(r.data.items[0].id, 'b1');
    assert.equal(r.data.items[0].coffee, 'Roast Lab Ethiopia Yirgacheffe');
  });

  it('list_gear and list_coffees return compact rows', async () => {
    const gear = await call(client, 'list_gear', {});
    assert.equal(gear.data.items[0].type, 'grinder');
    const coffees = await call(client, 'list_coffees', {});
    assert.equal(coffees.data.total, 2);
    assert.equal(coffees.data.items[0].imageUrl, undefined, 'no bulky image data in the list');
  });
});

describe('get_brew_graph', () => {
  it('returns the graph of one brew', async () => {
    const r = await call(client, 'get_brew_graph', { brewId: 'k1' });
    assert.equal(r.isError, false, r.text);
    assert.equal(r.data.graph.points.length, 40);
  });

  it('reports a missing graph', async () => {
    const r = await call(client, 'get_brew_graph', { brewId: 'k2' });
    assert.equal(r.isError, true);
    assert.match(r.text, /No brew graph/);
  });

  it('refuses a graph above MCP_MAX_GRAPH_BYTES', async () => {
    const tinyClient = await connectMcp(tiny.url, await mintAccess(tinyGraphCfg, { uid: UID, email: 'reader@example.com' }));
    try {
      const r = await call(tinyClient, 'get_brew_graph', { brewId: 'k1' });
      assert.equal(r.isError, true);
      assert.match(r.text, /MCP_MAX_GRAPH_BYTES/);
    } finally {
      await tinyClient.close();
    }
  });
});
