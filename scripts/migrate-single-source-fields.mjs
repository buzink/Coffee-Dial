import admin from "firebase-admin";

import {
  commitOps,
  initDb,
  listTargetUserIds,
  normalizeText,
  nowIso,
  parseCommonArgs,
  parseDateMs,
  printCommonUsage,
} from "./admin-utils.mjs";

// Each field lives in one place: coffee details on the coffee (coffeeTypes), bag details on
// the bag (beans, which link a coffee by coffeeTypeId), brew details on the brew (coffees,
// which link a bag by beanId and gear by gearIds). This removes the copies brews and bags
// used to carry, after making sure nothing is lost:
//  1. a grinder typed on a brew becomes a link to grinder gear (found by name or created);
//  2. a bag without a coffee gets one, made from the bag's own fields;
//  3. a brew without a usable bag gets a coffee (matched or made from its own fields) and a
//     finished bag for that coffee;
//  4. the copied fields are deleted from brews and bags.
// Where a brew or bag disagrees with its coffee, the coffee wins; the dry run lists these.

const SCRIPT = "scripts/migrate-single-source-fields.mjs";
const BREW_FIELDS = ["roaster", "farmer", "origin", "originMicroRegion", "variety", "processing", "roastType", "roast", "beanType", "name", "decaf", "grinder"];
const BAG_FIELDS = ["roaster", "farmer", "origin", "originMicroRegion", "variety", "processing", "roastType", "roast", "name", "decaf"];
const COMPARE = [["roaster", "roaster"], ["farmer", "farmer"], ["origin", "origin"], ["variety", "variety"], ["processing", "processing"], ["roastType", "roast"]];

const clean = (value) => {
  const text = (value ?? "").toString().trim().replace(/\s+/g, " ");
  return text && text !== "-" ? text : "";
};
const isGrinder = (item) => normalizeText(item?.type) === "grinder";

// Coffee fields as a brew or bag carried them (old brews used name/beanType for roaster/origin).
const coffeeFieldsOf = (src) => ({
  roaster: clean(src.roaster) || clean(src.name),
  farmer: clean(src.farmer),
  origin: clean(src.origin) || clean(src.beanType),
  variety: clean(src.variety),
  processing: clean(src.processing),
  roast: clean(src.roastType) || clean(src.roast),
});
const coffeeKey = (f) => [f.roaster, f.farmer, f.processing, f.origin, f.roast].map(normalizeText).join("|");
const typeKey = (t) => coffeeKey({ roaster: t.roaster, farmer: t.farmer, processing: t.processing, origin: t.origin, roast: t.roast || t.roastType });

async function processUser(db, uid, apply, report) {
  const userRef = db.collection("users").doc(uid);
  const [brewsSnap, beansSnap, typesSnap, gearSnap] = await Promise.all(
    ["coffees", "beans", "coffeeTypes", "gear"].map((name) => userRef.collection(name).get())
  );
  const brews = brewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const beans = beansSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const types = typesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const gear = gearSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const ops = [];
  const stamp = nowIso();
  const created = { gear: 0, coffeeTypes: 0, beans: 0 };
  const lost = [];

  const beanById = new Map(beans.map((b) => [b.id, b]));
  const typeById = new Map(types.map((t) => [t.id, t]));
  const typeByKey = new Map(types.map((t) => [typeKey(t), t]));
  const gearById = new Map(gear.map((g) => [g.id, g]));
  const grinderByName = new Map(gear.filter(isGrinder).map((g) => [normalizeText(g.name), g]));

  const makeCoffee = (fields, createdAt) => {
    const key = coffeeKey(fields);
    if (!key.replace(/\|/g, "")) return null;
    if (typeByKey.has(key)) return typeByKey.get(key);
    const ref = userRef.collection("coffeeTypes").doc();
    const data = {
      uid, ...fields, name: "", rating: 0, tasteNotes: "", webshopUrl: "", imageUrl: "",
      decaf: /decaf/i.test(Object.values(fields).join(" ")),
      createdAt: createdAt || stamp, updatedAt: stamp,
    };
    ops.push({ type: "set", ref, data });
    const type = { id: ref.id, ...data };
    typeById.set(type.id, type);
    typeByKey.set(key, type);
    created.coffeeTypes += 1;
    return type;
  };

  // 2. Bags without a coffee.
  const bagUpdates = new Map();
  for (const bean of beans) {
    if (bean.coffeeTypeId && typeById.has(bean.coffeeTypeId)) continue;
    const type = makeCoffee(coffeeFieldsOf(bean), bean.createdAt);
    if (type) {
      bean.coffeeTypeId = type.id;
      bagUpdates.set(bean.id, { coffeeTypeId: type.id });
    }
  }

  // 3. Brews without a usable bag: one finished bag per coffee.
  const orphanBagByType = new Map();
  const brewUpdates = new Map();
  const patch = (id, data) => brewUpdates.set(id, { ...(brewUpdates.get(id) || {}), ...data });
  for (const brew of brews) {
    if (brew.beanId && beanById.has(brew.beanId)) continue;
    const type = makeCoffee(coffeeFieldsOf(brew), brew.createdAt);
    if (!type) {
      if (brew.beanId) patch(brew.id, { beanId: admin.firestore.FieldValue.delete() });
      continue;
    }
    let bag = orphanBagByType.get(type.id);
    if (!bag) {
      const ref = userRef.collection("beans").doc();
      bag = {
        id: ref.id, ref, coffeeTypeId: type.id, archived: true, frozen: false, stock: null, beansLeft: null,
        price: null, shopUrl: "", frozenDate: null, roastDate: null, openedDate: null, archivedDate: null,
        createdAt: stamp, updatedAt: stamp,
      };
      orphanBagByType.set(type.id, bag);
      beanById.set(bag.id, bag);
      created.beans += 1;
    }
    const ms = parseDateMs(brew.createdAt);
    if (Number.isFinite(ms)) {
      const iso = new Date(ms).toISOString();
      if (!bag.openedDate || iso < bag.openedDate) bag.openedDate = iso;
      if (!bag.archivedDate || iso > bag.archivedDate) bag.archivedDate = iso;
    }
    patch(brew.id, { beanId: bag.id });
    brew.beanId = bag.id;
  }
  for (const { ref, id, ...data } of orphanBagByType.values()) {
    ops.push({ type: "set", ref, data: { ...data, openedDate: data.openedDate || stamp, archivedDate: data.archivedDate || stamp } });
  }

  // 1. Grinder text → grinder gear link.
  for (const brew of brews) {
    const name = clean(brew.grinder);
    if (!name) continue;
    const ids = Array.isArray(brew.gearIds) ? brew.gearIds.filter(Boolean) : [];
    if (ids.some((id) => isGrinder(gearById.get(id)))) continue;
    let grinder = grinderByName.get(normalizeText(name));
    if (!grinder) {
      const ref = userRef.collection("gear").doc();
      const data = { name, type: "grinder", price: null, methods: [], imageUrl: "", archived: false, purchasedDate: stamp, createdAt: stamp, updatedAt: stamp };
      ops.push({ type: "set", ref, data });
      grinder = { id: ref.id, ...data };
      gearById.set(grinder.id, grinder);
      grinderByName.set(normalizeText(name), grinder);
      created.gear += 1;
    }
    patch(brew.id, { gearIds: [...new Set([...ids, grinder.id])] });
  }

  // Values that differ from (or are missing on) the coffee are dropped: list them.
  const noteLost = (kind, item, type) => {
    const own = coffeeFieldsOf(item);
    COMPARE.forEach(([field, typeField]) => {
      const mine = own[typeField === "roast" ? "roast" : field];
      const theirs = clean(type?.[typeField] || (typeField === "roast" ? type?.roastType : ""));
      if (mine && normalizeText(mine) !== normalizeText(theirs)) lost.push(`${kind} ${item.id} ${field}: "${mine}" (coffee: "${theirs}")`);
    });
  };
  beans.forEach((bean) => noteLost("bag", bean, typeById.get(bean.coffeeTypeId)));
  brews.forEach((brew) => noteLost("brew", brew, typeById.get(beanById.get(brew.beanId)?.coffeeTypeId)));

  // 4. Delete the copies.
  const del = admin.firestore.FieldValue.delete();
  for (const bean of beans) {
    const data = { ...(bagUpdates.get(bean.id) || {}) };
    BAG_FIELDS.forEach((f) => { if (f in bean) data[f] = del; });
    if (Object.keys(data).length) ops.push({ type: "update", ref: userRef.collection("beans").doc(bean.id), data: { ...data, updatedAt: stamp } });
  }
  let brewsCleaned = 0;
  for (const brew of brews) {
    const data = { ...(brewUpdates.get(brew.id) || {}) };
    BREW_FIELDS.forEach((f) => { if (f in brew) data[f] = del; });
    if (Object.keys(data).length) {
      ops.push({ type: "update", ref: userRef.collection("coffees").doc(brew.id), data });
      brewsCleaned += 1;
    }
  }

  const written = await commitOps(db, ops, apply);
  report.push({ uid, brews: brews.length, brewsCleaned, bags: beans.length, created, lost, writes: ops.length, written });
}

async function main() {
  const args = parseCommonArgs(process.argv.slice(2));
  if (args.help) {
    printCommonUsage(SCRIPT, "Keep each coffee, bag and brew field in one place: link grinders as gear, give orphan brews a coffee and bag, and delete the copies on brews and bags.");
    return;
  }
  const db = initDb(args.projectId);
  const uids = await listTargetUserIds(db, args);
  const report = [];
  for (const uid of uids) await processUser(db, uid, args.apply, report);

  for (const r of report) {
    console.log(`\nUser ${r.uid}: ${r.brews} brews (${r.brewsCleaned} changed), ${r.bags} bags; new coffees ${r.created.coffeeTypes}, new bags ${r.created.beans}, new grinders ${r.created.gear}; writes ${r.writes}${args.apply ? `, written ${r.written}` : ""}`);
    if (r.lost.length) {
      console.log(`  Values that differ from the coffee and are dropped (${r.lost.length}):`);
      r.lost.forEach((line) => console.log(`   - ${line}`));
    }
  }
  console.log(args.apply ? "\nApplied." : "\nDry run: nothing written (use --apply).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
