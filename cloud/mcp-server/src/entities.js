// Reads and writes for coffees (coffeeTypes), bags (beans), brews (coffees), gear and brew graphs.
// Every function gets a Store, which only reaches users/{uid}. Reads return compact rows. Writes
// are dry runs unless `apply` is true, and then they return the same proposal plus `applied: true`.

import { NotFoundError, ValidationError } from './errors.js';
import { assertDocSize, consumeWriteQuota } from './limits.js';
import { BREW_SHAPE, GEAR_SHAPE, HINTS, COFFEE_SHAPE, parseWriteInput, BAG_SHAPE } from './validate.js';

const clamp = (value, max) => Math.min(Math.max(Number(value) || max, 1), max);
const nn = (value) => (value === undefined ? null : value);
const filled = (value) => (typeof value === 'number' ? Number.isFinite(value) : typeof value === 'string' && value.trim() !== '');
const round2 = (value) => Math.round(value * 100) / 100;
const average = (values) => (values.length ? round2(values.reduce((s, v) => s + v, 0) / values.length) : null);

export const coffeeLabel = (c) => {
  if (!c) return null;
  return [c.roaster, c.name].filter(Boolean).join(' ') || c.farmer || c.origin || '(unnamed coffee)';
};

function page(items, limit, max) {
  const n = clamp(limit, max);
  return { count: Math.min(items.length, n), total: items.length, truncated: items.length > n, items: items.slice(0, n) };
}

// ---- output mappers ------------------------------------------------------------------------

const coffeeOut = (c) => ({
  id: c.id,
  name: nn(c.name),
  roaster: nn(c.roaster),
  farmer: nn(c.farmer),
  origin: nn(c.origin),
  originMicroRegion: nn(c.originMicroRegion),
  originMacroRegion: nn(c.originMacroRegion),
  variety: nn(c.variety),
  processing: nn(c.processing),
  roast: nn(c.roast ?? c.roastType),
  decaf: !!c.decaf,
  rating: Number(c.rating) || 0,
  tasteNotes: c.tasteNotes || '',
  webshopUrl: nn(c.webshopUrl),
});

const bagOut = (b, coffees) => ({
  id: b.id,
  coffeeTypeId: nn(b.coffeeTypeId),
  coffee: coffeeLabel(coffees.get(b.coffeeTypeId)),
  stock: nn(b.stock),
  beansLeft: nn(b.beansLeft),
  price: nn(b.price),
  shopUrl: nn(b.shopUrl),
  archived: !!b.archived,
  frozen: !!b.frozen,
  openedDate: nn(b.openedDate),
  archivedDate: nn(b.archivedDate),
  frozenDate: nn(b.frozenDate),
  roastDate: nn(b.roastDate),
});

const gearOut = (g) => ({
  id: g.id,
  name: nn(g.name),
  type: nn(g.type),
  price: nn(g.price),
  methods: Array.isArray(g.methods) ? g.methods : [],
  archived: !!g.archived,
  purchasedDate: nn(g.purchasedDate),
});

const brewOut = (b, { bags, coffees, gear }) => {
  const bag = b.beanId ? bags.get(b.beanId) : null;
  return {
    id: b.id,
    beanId: nn(b.beanId),
    coffee: bag ? coffeeLabel(coffees.get(bag.coffeeTypeId)) : null,
    method: nn(b.method),
    grind: nn(b.grind),
    weight: nn(b.weight),
    ratio: nn(b.ratio),
    time: nn(b.time),
    temp: nn(b.temp),
    drink: nn(b.drink),
    notes: nn(b.notes),
    improve: nn(b.improve),
    rating: Number(b.rating) || 0,
    firstDrip: nn(b.firstDrip),
    maxFlow: nn(b.maxFlow),
    avgFlow: nn(b.avgFlow),
    gear: (Array.isArray(b.gearIds) ? b.gearIds : []).map((id) => {
      const g = gear.get(id);
      return g ? { id, name: g.name || null, type: g.type || null } : { id, name: null, type: null };
    }),
    createdAt: nn(b.createdAt),
  };
};

// Maps by id, so list functions can look up a bag, coffee or gear without a read each.
const byId = (rows) => new Map(rows.map((r) => [r.id, r]));
const byCreatedDesc = (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
const byLabel = (a, b) => coffeeLabel(a).localeCompare(coffeeLabel(b));

// ---- reads ---------------------------------------------------------------------------------

export async function listCoffees(store, { limit } = {}, cfg) {
  const rows = (await store.listAll('coffeeTypes')).map(coffeeOut).sort((a, b) => byLabel(a, b));
  return page(rows, limit, cfg.listMax);
}

export async function listBags(store, { limit, includeArchived = true } = {}, cfg) {
  const [beans, coffees] = await Promise.all([store.listAll('beans'), store.listAll('coffeeTypes')]);
  const coffeeMap = byId(coffees);
  const rows = beans
    .filter((b) => includeArchived || !b.archived)
    .map((b) => bagOut(b, coffeeMap))
    .sort((a, b) => String(a.coffee).localeCompare(String(b.coffee)));
  return page(rows, limit, cfg.listMax);
}

export async function listBrews(store, { limit, beanId, method } = {}, cfg) {
  const [brews, bags, coffees, gear] = await Promise.all(
    ['coffees', 'beans', 'coffeeTypes', 'gear'].map((name) => store.listAll(name)),
  );
  const ctx = { bags: byId(bags), coffees: byId(coffees), gear: byId(gear) };
  const rows = brews
    .filter((b) => !beanId || b.beanId === beanId)
    .filter((b) => !method || String(b.method || '').toLowerCase() === String(method).toLowerCase())
    .sort(byCreatedDesc)
    .map((b) => brewOut(b, ctx));
  return page(rows, limit, cfg.listMax);
}

export async function listGear(store, { limit, includeArchived = true } = {}, cfg) {
  const rows = (await store.listAll('gear'))
    .filter((g) => includeArchived || !g.archived)
    .map(gearOut)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return page(rows, limit, cfg.listMax);
}

// Ratings and counts, computed here so the client only gets the summary. Unrated brews (rating 0)
// are left out of the averages but counted as brews.
export async function getAnalysis(store) {
  const [coffees, bags, brews, gear] = await Promise.all(
    ['coffeeTypes', 'beans', 'coffees', 'gear'].map((name) => store.listAll(name)),
  );
  const bagMap = byId(bags);
  const coffeeMap = byId(coffees);
  const rated = (list) => list.filter((b) => Number(b.rating) > 0);
  const summary = (list) => ({
    brews: list.length,
    rated: rated(list).length,
    averageRating: average(rated(list).map((b) => Number(b.rating))),
  });
  const group = (keyOf, labelOf) => {
    const groups = new Map();
    for (const b of brews) {
      const key = keyOf(b);
      if (key === null) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    }
    return [...groups.entries()]
      .map(([key, list]) => ({ key, label: labelOf(key), ...summary(list) }))
      .sort((a, b) => b.brews - a.brews);
  };
  const byMethod = group(
    (b) => String(b.method || '').trim() || '(no method)',
    (key) => key,
  );
  const byBag = group(
    (b) => (b.beanId && bagMap.has(b.beanId) ? b.beanId : null),
    (key) => coffeeLabel(coffeeMap.get(bagMap.get(key)?.coffeeTypeId)),
  );
  return {
    totals: {
      coffees: coffees.length,
      bags: bags.length,
      bagsArchived: bags.filter((b) => b.archived).length,
      brews: brews.length,
      brewsWithoutBag: brews.filter((b) => !b.beanId || !bagMap.has(b.beanId)).length,
      gear: gear.length,
      gearArchived: gear.filter((g) => g.archived).length,
      ...summary(brews),
    },
    byMethod: { count: byMethod.length, items: byMethod.slice(0, 50), truncated: byMethod.length > 50 },
    byBag: { count: byBag.length, items: byBag.slice(0, 100), truncated: byBag.length > 100 },
  };
}

export async function getBrewGraph(store, { brewId }, cfg) {
  const snap = await store.doc('brewGraphs', brewId).get();
  if (!snap.exists) throw new NotFoundError(`No brew graph for brew ${brewId}`);
  const graph = snap.data();
  const bytes = Buffer.byteLength(JSON.stringify(graph), 'utf8');
  if (bytes > cfg.maxGraphBytes) {
    throw new ValidationError(`The brew graph is ${bytes} bytes; the limit is ${cfg.maxGraphBytes} (MCP_MAX_GRAPH_BYTES).`);
  }
  return { brewId, bytes, graph };
}

// ---- writes --------------------------------------------------------------------------------

async function brewWeightFor(store, beanId) {
  const snap = await store.collection('coffees').where('beanId', '==', beanId).get();
  return snap.docs.reduce((sum, d) => sum + (Number(d.data().weight) || 0), 0);
}

// beansLeft is derived: stock minus the weight of every brew on the bag.
async function recalcBeansLeft(store, beanId) {
  const ref = store.doc('beans', beanId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const bag = snap.data();
  if (bag.stock === null || bag.stock === undefined) return;
  const beansLeft = Number(bag.stock) - (await brewWeightFor(store, beanId));
  if (bag.beansLeft !== beansLeft) await ref.update({ beansLeft, updatedAt: new Date().toISOString() });
}

// Shared write path: merge, validate, dry-run or apply. `prepare` adds defaults and checks that
// only this entity can run; it may return { sideEffects, afterWrite } and sets fields on `data`.
async function upsert(store, cfg, { collection, id, fields, apply, prepare, render }) {
  const ref = id ? store.doc(collection, id) : store.collection(collection).doc();
  let before = null;
  if (id) {
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundError(`No ${collection} document with id ${id}`);
    before = snap.data();
  }
  const now = new Date().toISOString();
  const data = { ...(before || {}), ...fields, uid: store.uid, createdAt: before?.createdAt ?? fields.createdAt ?? now, updatedAt: now };
  delete data.id;
  delete data.apply;

  const extra = (await prepare(data, { before, ref, store, now })) || {};
  assertDocSize(data, cfg.maxDocBytes);

  const changes = Object.keys(fields)
    .filter((key) => key !== 'id' && key !== 'apply')
    .map((key) => ({ field: key, from: nn(before?.[key]), to: nn(data[key]) }))
    .filter((change) => JSON.stringify(change.from) !== JSON.stringify(change.to));
  const action = before ? 'update' : 'create';
  const sideEffects = extra.sideEffects || [];

  if (!apply) {
    return { applied: false, action, id: ref.id, changes, sideEffects, document: await render(data, ref.id) };
  }
  await consumeWriteQuota(store, cfg.writeLimitPerHour);
  await ref.set(data);
  if (extra.afterWrite) await extra.afterWrite();
  return { applied: true, action, id: ref.id, changes, sideEffects, document: await render(data, ref.id) };
}

// Defaults only fill keys that are still undefined, so a value the caller sent (even null) wins.
const withDefaults = (data, defaults) => {
  for (const [key, value] of Object.entries(defaults)) {
    if (data[key] === undefined) data[key] = value;
  }
  return data;
};
const normalizeText = (data, fields) => {
  for (const f of fields) if (data[f] === null) data[f] = '';
};

export async function upsertCoffee(store, cfg, args) {
  const input = parseWriteInput(args, { label: 'coffee', shape: COFFEE_SHAPE, hints: HINTS.coffee });
  const textFields = ['name', 'roaster', 'farmer', 'origin', 'originMicroRegion', 'originMacroRegion', 'variety', 'processing', 'roast', 'tasteNotes'];
  return upsert(store, cfg, {
    collection: 'coffeeTypes',
    id: input.id,
    fields: input,
    apply: input.apply,
    prepare: (data, { before }) => {
      normalizeText(data, textFields);
      data.webshopUrl = data.webshopUrl ?? '';
      if (!before) withDefaults(data, { tasteNotes: '', rating: 0, decaf: false, imageUrl: '' });
      if (!filled(data.name) && !filled(data.roaster)) {
        throw new ValidationError('A coffee needs a name or a roaster');
      }
      return {};
    },
    render: async (data, id) => coffeeOut({ ...data, id }),
  });
}

export async function upsertBag(store, cfg, args) {
  const input = parseWriteInput(args, { label: 'bag', shape: BAG_SHAPE, hints: HINTS.bag });
  return upsert(store, cfg, {
    collection: 'beans',
    id: input.id,
    fields: input,
    apply: input.apply,
    prepare: async (data, { before, ref, store: s, now }) => {
      if (!filled(data.coffeeTypeId)) throw new ValidationError('A bag needs a coffeeTypeId: create the coffee with upsert_coffee first');
      const coffee = await s.doc('coffeeTypes', data.coffeeTypeId).get();
      if (!coffee.exists) throw new ValidationError(`coffeeTypeId ${data.coffeeTypeId} does not exist`);
      if (!before) withDefaults(data, { archived: false, frozen: false, stock: null, price: null, shopUrl: '' });
      data.shopUrl = data.shopUrl ?? '';
      if (data.archived && !data.archivedDate) data.archivedDate = now;
      data.beansLeft = data.stock === null || data.stock === undefined
        ? null
        : Number(data.stock) - (await brewWeightFor(s, ref.id));
      return {};
    },
    render: async (data, id) => {
      const coffees = byId((await store.listAll('coffeeTypes')));
      return bagOut({ ...data, id }, coffees);
    },
  });
}

export async function upsertBrew(store, cfg, args) {
  const input = parseWriteInput(args, { label: 'brew', shape: BREW_SHAPE, hints: HINTS.brew });
  return upsert(store, cfg, {
    collection: 'coffees',
    id: input.id,
    fields: input,
    apply: input.apply,
    prepare: async (data, { before, store: s }) => {
      normalizeText(data, ['method', 'drink', 'notes', 'improve']);
      if (!before) withDefaults(data, { method: '', drink: '', notes: '', improve: '', rating: 0, gearIds: [], beanId: null });
      if (data.beanId) {
        const bag = await s.doc('beans', data.beanId).get();
        if (!bag.exists) throw new ValidationError(`beanId ${data.beanId} does not exist`);
      }
      const gearIds = Array.isArray(data.gearIds) ? [...new Set(data.gearIds)] : [];
      if (gearIds.length) {
        const snaps = await s.db.getAll(...gearIds.map((gid) => s.doc('gear', gid)));
        const missing = gearIds.filter((gid, i) => !snaps[i].exists);
        if (missing.length) throw new ValidationError(`gearIds not found in gear: ${missing.join(', ')}`);
      }
      data.gearIds = gearIds;
      const affected = [...new Set([before?.beanId, data.beanId].filter(Boolean))];
      return {
        sideEffects: affected.map((bagId) => `beansLeft of bag ${bagId} is recalculated from its brews`),
        afterWrite: async () => {
          for (const bagId of affected) await recalcBeansLeft(s, bagId);
        },
      };
    },
    render: async (data, id) => {
      const [bags, coffees, gear] = await Promise.all(['beans', 'coffeeTypes', 'gear'].map((n) => store.listAll(n)));
      return brewOut({ ...data, id }, { bags: byId(bags), coffees: byId(coffees), gear: byId(gear) });
    },
  });
}

export async function upsertGear(store, cfg, args) {
  const input = parseWriteInput(args, { label: 'gear item', shape: GEAR_SHAPE, hints: HINTS.gear });
  return upsert(store, cfg, {
    collection: 'gear',
    id: input.id,
    fields: input,
    apply: input.apply,
    prepare: (data, { before, now }) => {
      if (!before) withDefaults(data, { type: '', price: null, methods: [], archived: false, purchasedDate: now });
      if (!filled(data.name)) throw new ValidationError('A gear item needs a name');
      return {};
    },
    render: async (data, id) => gearOut({ ...data, id }),
  });
}
