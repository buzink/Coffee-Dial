// Two-way brew sync between Coffee Dial and Tieme's app.
//
//   Tieme:  coffee-dial-app-9db38  users/{tieme}/simpleRecipes  ->  coffee-dial-buzink  users/{tieme}/{coffeeTypes,beans,coffees}
//   Robert: coffee-dial-buzink     users/{robert}/coffees       ->  coffee-dial-app-9db38  users/{robert}/simpleRecipes
//
// The two apps store brews differently. Coffee Dial keeps one document per brew, linked to a
// bean and a coffee type. Tieme's app keeps one document per coffee ("simpleRecipes") holding
// the current recipe per method and drink: methods[method][drink] = {dose, out, grind, ...}.
//
// Each run starts from the date the target already has:
//   Tieme  -> the newest createdAt among Tieme's brews in coffee-dial-buzink. Recipe documents
//             created on or after that date are imported (one brew per method/drink).
//   Robert -> the newest Coffee Dial brew date already written into Robert's simpleRecipes
//             (stored as coffeeDial.lastBrewAt on the documents this script writes). Brews created
//             after that date are grouped per bean and merged into that bean's recipe document.
// Written documents get fixed ids, so a run that overlaps an earlier one never makes duplicates.
//
// The script reads anything but writes only to the two paths above; see assertWritable.
//
// Auth: uses the active gcloud account (gcloud auth print-access-token). Pass --adc to use
// application-default credentials instead.
//
// Usage:
//   node scripts/sync-simple-recipes.mjs                 dry run, both directions
//   node scripts/sync-simple-recipes.mjs --apply         write
//   node scripts/sync-simple-recipes.mjs --only tieme    or --only robert
//   node scripts/sync-simple-recipes.mjs --since 2026-01-01   override the start date
import {createRequire} from "module";
import {execSync} from "child_process";
import {createHash} from "crypto";
import {formatOriginLabel} from "../src/core/origin-regions.js";

const require = createRequire(import.meta.url);
const {Firestore} = require("@google-cloud/firestore");

const OLD_PROJECT = "coffee-dial-app-9db38";
const NEW_PROJECT = "coffee-dial-buzink";
const TIEME_UID = "VwgxGenwr6ac3m7eKYOnRdxG4Sy1";
const ROBERT_UID = "VNV0hhvFbbTRwvDaiUqxZY0km3L2";

// The only places this script may write to.
const WRITABLE = {
  [NEW_PROJECT]: new RegExp(`^users/${TIEME_UID}/(coffeeTypes|beans|coffees)/[^/]+$`),
  [OLD_PROJECT]: new RegExp(`^users/${ROBERT_UID}/simpleRecipes/[^/]+$`),
};

// Method names that differ between the apps (Tieme's app -> Coffee Dial).
const METHOD_TO_CD = {OXO: "OXO Rapid Brewer"};
const METHOD_TO_SIMPLE = Object.fromEntries(Object.entries(METHOD_TO_CD).map(([a, b]) => [b, a]));

// Beans older than this are imported as archived, so they don't fill Tieme's bean list.
const ARCHIVE_AFTER_DAYS = 30;

// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {apply: false, only: "", since: "", adc: false};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--adc") args.adc = true;
    else if (a === "--only" && argv[i + 1]) args.only = argv[++i];
    else if (a === "--since" && argv[i + 1]) args.since = argv[++i];
    else if (a === "--help") args.help = true;
  }
  return args;
}

function openDb(projectId, useAdc) {
  if (useAdc) return new Firestore({projectId});
  const {OAuth2Client} = require("google-auth-library");
  const token = execSync("gcloud auth print-access-token", {encoding: "utf8"}).trim();
  const authClient = new OAuth2Client();
  authClient.setCredentials({access_token: token});
  return new Firestore({projectId, authClient});
}

function assertWritable(db, ref) {
  const rule = WRITABLE[db.targetProject];
  if (!rule || !rule.test(ref.path)) {
    throw new Error(`Refusing to write ${db.targetProject}/${ref.path}: outside the allowed paths.`);
  }
}

// Collects writes, checks every path, and commits in batches.
class Writer {
  constructor(db, apply) {
    this.db = db;
    this.apply = apply;
    this.ops = [];
  }
  set(ref, data, options) {
    assertWritable(this.db, ref);
    this.ops.push({ref, data, options});
  }
  async commit() {
    if (!this.apply) return 0;
    for (let i = 0; i < this.ops.length; i += 400) {
      const batch = this.db.batch();
      this.ops.slice(i, i + 400).forEach(({ref, data, options}) =>
        options ? batch.set(ref, data, options) : batch.set(ref, data));
      await batch.commit();
    }
    return this.ops.length;
  }
}

const toMs = (value) => {
  if (!value) return Number.NaN;
  const d = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return d.getTime();
};
const toIso = (ms) => new Date(ms).toISOString();
const norm = (v) => (v ?? "").toString().trim().replace(/\s+/g, " ").toLowerCase();
const shortHash = (s) => createHash("sha1").update(s).digest("hex").slice(0, 10);
const clean = (v) => (v === undefined || v === null ? "" : String(v).trim());

// "18" -> 18, "L1" -> null, "" -> null
const num = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
// Numbers are written as strings in simpleRecipes; keep at most 2 decimals.
const numStr = (v) => {
  const n = num(v);
  if (n === null) return "";
  return String(Math.round(n * 100) / 100);
};

async function readAll(db, path) {
  const snap = await db.collection(path).get();
  return snap.docs.map((d) => ({id: d.id, ...d.data()}));
}

// ---------------------------------------------------------------------------------------------
// Tieme: simpleRecipes (old project) -> Coffee Dial brews (new project)

// "La Higuera - LOT61" with roaster LOT61 -> "La Higuera". Older recipes may lack `blend`.
function blendOf(recipe) {
  if (clean(recipe.blend)) return clean(recipe.blend);
  const name = clean(recipe.name);
  const roaster = clean(recipe.roaster);
  if (roaster && name.endsWith(` - ${roaster}`)) return name.slice(0, -(roaster.length + 3));
  return name;
}

// How a coffee is named in both apps: its name, or the farmer for coffees without a name
// (all coffees made before Coffee Dial had a name field). Keys on this stay the same for those.
const coffeeLabel = (type) => clean(type?.name) || clean(type?.farmer);

async function syncTieme({oldDb, newDb, apply, since}) {
  console.log(`\n== Tieme: ${OLD_PROJECT} simpleRecipes -> ${NEW_PROJECT} brews ==`);
  const base = `users/${TIEME_UID}`;
  const [recipes, brews, beans, types, gear] = await Promise.all([
    readAll(oldDb, `${base}/simpleRecipes`),
    readAll(newDb, `${base}/coffees`),
    readAll(newDb, `${base}/beans`),
    readAll(newDb, `${base}/coffeeTypes`),
    readAll(newDb, `${base}/gear`),
  ]);

  const newestBrewMs = Math.max(0, ...brews.map((b) => toMs(b.createdAt)).filter(Number.isFinite));
  const fromMs = since ? toMs(since) : newestBrewMs;
  console.log(`Newest brew already in ${NEW_PROJECT}: ${newestBrewMs ? toIso(newestBrewMs) : "none"}`);
  console.log(`Importing recipes created on or after: ${fromMs ? toIso(fromMs) : "the beginning"}`);

  const existingIds = new Set(brews.map((b) => b.id));
  const beanIds = new Set(beans.map((b) => b.id));
  const typeByKey = new Map(types.map((t) => [`${norm(t.roaster)}|${norm(coffeeLabel(t))}`, t]));
  const typeIds = new Set(types.map((t) => t.id));
  const gearByName = new Map(gear.filter((g) => !g.archived && g.name).map((g) => [norm(g.name), g]));
  let customOrder = Math.min(0, ...brews.map((b) => Number(b.customOrder)).filter(Number.isFinite));

  const writer = new Writer(newDb, apply);
  const todo = recipes
    .filter((r) => Number.isFinite(toMs(r.createdAt)) && toMs(r.createdAt) >= fromMs)
    .sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));

  let newBrews = 0;
  for (const recipe of todo) {
    const createdMs = toMs(recipe.createdAt);
    const roaster = clean(recipe.roaster);
    // Tieme's blend is the coffee's name; his farmer field is the farm (often empty).
    const name = blendOf(recipe);
    const farmer = clean(recipe.farmer);
    const coffee = {
      roaster,
      farmer,
      // Tieme's origin goes in as the country.
      origin: clean(recipe.origin),
      variety: clean(recipe.variety),
      processing: clean(recipe.processing),
      roastType: clean(recipe.roastType),
    };

    // Coffee type: reuse one with the same roaster and name, else create one.
    let type = typeByKey.get(`${norm(roaster)}|${norm(name)}`);
    if (!type) {
      const id = `sr_${recipe.id}`;
      type = {id};
      if (!typeIds.has(id)) {
        writer.set(newDb.doc(`${base}/coffeeTypes/${id}`), {
          uid: TIEME_UID,
          roaster,
          name,
          farmer,
          origin: coffee.origin,
          variety: coffee.variety,
          processing: coffee.processing,
          roast: coffee.roastType,
          rating: 0,
          webshopUrl: clean(recipe.roasterUrl),
          tasteNotes: "",
          decaf: /decaf/i.test(`${recipe.name} ${name}`),
          imageUrl: "",
          createdAt: toIso(createdMs),
          updatedAt: toIso(createdMs),
          importedFrom: {project: OLD_PROJECT, path: `${base}/simpleRecipes/${recipe.id}`},
        });
        typeIds.add(id);
      }
      typeByKey.set(`${norm(roaster)}|${norm(name)}`, type);
    }

    // One bean per recipe document.
    const beanId = `sr_${recipe.id}`;
    if (!beanIds.has(beanId)) {
      const archived = Date.now() - createdMs > ARCHIVE_AFTER_DAYS * 86400000;
      writer.set(newDb.doc(`${base}/beans/${beanId}`), {
        coffeeTypeId: type.id,
        ...coffee,
        shopUrl: clean(recipe.roasterUrl),
        stock: null,
        beansLeft: null,
        price: null,
        frozen: false,
        frozenDate: null,
        roastDate: null,
        openedDate: toIso(createdMs),
        archived,
        archivedDate: archived ? toIso(Date.now()) : null,
        createdAt: toIso(createdMs),
        updatedAt: toIso(createdMs),
        importedFrom: {project: OLD_PROJECT, path: `${base}/simpleRecipes/${recipe.id}`},
      });
      beanIds.add(beanId);
    }

    // One brew per method and drink, in the order Tieme's app shows them.
    const methods = recipe.methods || {};
    const methodOrder = [...new Set([...(recipe.methodOrder || []), ...Object.keys(methods)])]
      .filter((m) => methods[m]);
    let offset = 0;
    for (const method of methodOrder) {
      const drinkOrder = [...new Set([...(recipe.drinkOrder?.[method] || []), ...Object.keys(methods[method])])]
        .filter((d) => methods[method][d]);
      for (const drink of drinkOrder) {
        const r = methods[method][drink];
        const id = `sr_${recipe.id}_${shortHash(`${method}|${drink}`)}`;
        offset += 1;
        if (existingIds.has(id)) continue;

        const dose = num(r.dose);
        const out = num(r.out);
        const ratio = num(r.ratio) ?? (dose && out ? Math.round((out / dose) * 100) / 100 : null);
        const grinder = clean(r.gear);
        const grinderGear = gearByName.get(norm(grinder));
        const notes = [clean(r.notes), r.basket ? `Basket: ${clean(r.basket)}` : ""].filter(Boolean).join("\n");
        const at = toIso(createdMs + offset);
        customOrder -= 1;

        writer.set(newDb.doc(`${base}/coffees/${id}`), {
          ...coffee,
          beanId,
          method: METHOD_TO_CD[method] || method,
          drink,
          grinder,
          grind: num(r.grind) ?? clean(r.grind),
          weight: dose,
          ratio,
          time: num(r.time),
          temp: clean(r.temp),
          notes,
          improve: clean(r.improve),
          rating: num(r.rating) ?? 0,
          gearIds: grinderGear ? [grinderGear.id] : [],
          firstDrip: null,
          maxFlow: null,
          avgFlow: null,
          customOrder,
          isActive: false,
          createdAt: at,
          updatedAt: at,
          importedFrom: {project: OLD_PROJECT, path: `${base}/simpleRecipes/${recipe.id}`, method, drink},
        });
        existingIds.add(id);
        newBrews += 1;
        console.log(`  + ${at.slice(0, 10)}  ${recipe.name}  ${method} / ${drink}`);
      }
    }
  }

  console.log(`Recipe documents in range: ${todo.length}. New brews: ${newBrews}. Writes: ${writer.ops.length}.`);
  const written = await writer.commit();
  console.log(apply ? `Written: ${written}` : "Dry run: nothing written (use --apply).");
}

// ---------------------------------------------------------------------------------------------
// Robert: Coffee Dial brews (new project) -> simpleRecipes (old project)

function recipeEntry(brew, basket) {
  const dose = num(brew.weight);
  const ratio = num(brew.ratio);
  const entry = {
    dose: numStr(dose),
    out: dose && ratio ? String(Math.round(dose * ratio)) : "",
    grind: clean(brew.grind),
    time: numStr(brew.time),
    temp: clean(brew.temp),
    gear: clean(brew.grinder),
    ratio: numStr(ratio),
    rating: num(brew.rating) ?? 0,
    notes: clean(brew.notes),
    improve: clean(brew.improve),
  };
  if (basket) entry.basket = basket;
  return entry;
}

// A brew still being made (or abandoned half way) has no usable recipe.
const usableBrew = (b) => num(b.weight) > 0 && num(b.ratio) > 0;

async function syncRobert({oldDb, newDb, apply, since}) {
  console.log(`\n== Robert: ${NEW_PROJECT} brews -> ${OLD_PROJECT} simpleRecipes ==`);
  const base = `users/${ROBERT_UID}`;
  const [brews, beans, types, gear, recipes] = await Promise.all([
    readAll(newDb, `${base}/coffees`),
    readAll(newDb, `${base}/beans`),
    readAll(newDb, `${base}/coffeeTypes`),
    readAll(newDb, `${base}/gear`),
    readAll(oldDb, `${base}/simpleRecipes`),
  ]);

  // Only documents this script wrote count: they carry coffeeDial.lastBrewAt. If Tieme's app
  // dropped that field on an edit, the document's createdAt (first brew) is the safe fallback;
  // an earlier start only means some brews are merged again with the same result.
  const synced = recipes.filter((r) => r.id.startsWith("cd_"));
  const newestSyncedMs = Math.max(0, ...synced
    .map((r) => toMs(r.coffeeDial?.lastBrewAt ?? r.createdAt))
    .filter(Number.isFinite));
  const fromMs = since ? toMs(since) : newestSyncedMs;
  console.log(`Newest Coffee Dial brew already in ${OLD_PROJECT}: ${newestSyncedMs ? toIso(newestSyncedMs) : "none"}`);
  console.log(`Converting brews created after: ${fromMs ? toIso(fromMs) : "the beginning"}`);

  const beanById = new Map(beans.map((b) => [b.id, b]));
  const typeById = new Map(types.map((t) => [t.id, t]));
  const gearById = new Map(gear.map((g) => [g.id, g]));
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  const todo = brews
    .filter((b) => Number.isFinite(toMs(b.createdAt)) && toMs(b.createdAt) > fromMs && usableBrew(b))
    .sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));

  // Group per coffee (roaster + name), as Tieme's app keeps one document per coffee. A coffee
  // bought several times has several beans in Coffee Dial but ends up in one recipe document.
  const groups = new Map();
  for (const brew of todo) {
    const bean = beanById.get(brew.beanId);
    const type = typeById.get(bean?.coffeeTypeId);
    const pick = (field, typeField = field) => clean(brew[field]) || clean(bean?.[field]) || clean(type?.[typeField]);
    const coffee = {
      roaster: pick("roaster"),
      // Same label as before for coffees without a name, so their recipe documents keep their key.
      blend: clean(type?.name) || pick("farmer"),
      // Tieme's app has one origin field: "Micro-region, Country".
      origin: formatOriginLabel({origin: pick("origin"), originMicroRegion: type?.originMicroRegion}),
      variety: pick("variety"),
      processing: pick("processing"),
      roastType: pick("roastType", "roast"),
      roasterUrl: clean(bean?.shopUrl) || clean(type?.webshopUrl),
    };
    const key = shortHash(`${norm(coffee.roaster)}|${norm(coffee.blend)}`);
    if (!groups.has(key)) groups.set(key, {key, coffee, brews: [], beanIds: new Set()});
    const group = groups.get(key);
    group.coffee = {...group.coffee, ...Object.fromEntries(Object.entries(coffee).filter(([, v]) => v))};
    group.brews.push(brew);
    if (bean) group.beanIds.add(bean.id);
    if (bean && !bean.archived) group.inUse = true;
  }

  const writer = new Writer(oldDb, apply);
  for (const group of groups.values()) {
    const id = `cd_${group.key}`;
    const existing = recipeById.get(id);
    const methods = structuredClone(existing?.methods || {});
    const methodOrder = [...(existing?.methodOrder || [])];
    const drinkOrder = structuredClone(existing?.drinkOrder || {});

    // Oldest first, so the newest brew per method and drink wins.
    for (const brew of group.brews) {
      const method = METHOD_TO_SIMPLE[brew.method] || clean(brew.method) || "Other";
      methods[method] = methods[method] || {};
      // "Flat white" and "Flat White" are the same drink: reuse the spelling already there.
      const rawDrink = clean(brew.drink) || method;
      const drink = Object.keys(methods[method]).find((d) => norm(d) === norm(rawDrink)) || rawDrink;
      const basket = (brew.gearIds || [])
        .map((gid) => gearById.get(gid))
        .find((g) => g && /basket/i.test(`${g.type} ${g.name}`))?.name;
      methods[method][drink] = recipeEntry(brew, basket);
      if (!methodOrder.includes(method)) methodOrder.push(method);
      drinkOrder[method] = drinkOrder[method] || [];
      if (!drinkOrder[method].includes(drink)) drinkOrder[method].push(drink);
    }

    const firstAt = group.brews[0].createdAt;
    const lastAt = group.brews[group.brews.length - 1].createdAt;
    const {roaster, blend} = group.coffee;
    const doc = {
      ...group.coffee,
      farmer: existing?.farmer ?? "",
      name: [blend, roaster].filter(Boolean).join(" - ") || "Unknown coffee",
      createdAt: existing?.createdAt ?? toIso(toMs(firstAt)),
      // Tieme's app shows only open coffees on its home screen: open the ones whose bean is
      // still in use in Coffee Dial, leave the rest as they were.
      isOpen: group.inUse ? true : (existing?.isOpen ?? false),
      methodOrder,
      drinkOrder,
      methods,
      coffeeDial: {
        project: NEW_PROJECT,
        beanIds: [...new Set([...(existing?.coffeeDial?.beanIds || []), ...group.beanIds])],
        lastBrewAt: toIso(Math.max(toMs(lastAt), toMs(existing?.coffeeDial?.lastBrewAt) || 0)),
      },
    };
    writer.set(oldDb.doc(`${base}/simpleRecipes/${id}`), doc);
    const what = Object.entries(methods).map(([m, d]) => `${m}: ${Object.keys(d).join(", ")}`).join("; ");
    console.log(`  ${existing ? "~" : "+"} ${doc.name}  (${group.brews.length} brews -> ${what})`);
  }

  console.log(`Brews in range: ${todo.length}. Recipe documents to write: ${writer.ops.length}.`);
  const written = await writer.commit();
  console.log(apply ? `Written: ${written}` : "Dry run: nothing written (use --apply).");
}

// ---------------------------------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`\nUsage: node scripts/sync-simple-recipes.mjs [--apply] [--only tieme|robert] [--since ISO_DATE] [--adc]\n`);
  process.exit(0);
}
if (args.since && !Number.isFinite(toMs(args.since))) {
  console.error(`Invalid --since date: ${args.since}`);
  process.exit(1);
}

const oldDb = openDb(OLD_PROJECT, args.adc);
const newDb = openDb(NEW_PROJECT, args.adc);
oldDb.targetProject = OLD_PROJECT;
newDb.targetProject = NEW_PROJECT;

if (!args.only || args.only === "tieme") await syncTieme({oldDb, newDb, apply: args.apply, since: args.since});
if (!args.only || args.only === "robert") await syncRobert({oldDb, newDb, apply: args.apply, since: args.since});
