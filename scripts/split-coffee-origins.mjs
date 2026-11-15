import {
  commitOps,
  DEFAULT_PROJECT_ID,
  initDb,
  listTargetUserIds,
  nowIso,
  parseCommonArgs,
  printCommonUsage,
} from "./admin-utils.mjs";
import { getOriginMacroRegion, splitOriginValue } from "../src/core/origin-regions.js";

const SCRIPT = "scripts/split-coffee-origins.mjs";

const clean = (value) => (value || "").toString().trim();

// A coffee's old free-text origin ("Yirgacheffe, Ethiopia") becomes origin = country and
// originMicroRegion = the rest. Bags and brews of that coffee that carry the same old text
// get origin = country too, so the filters show one country value.
async function processUser(db, uid, apply) {
  const userRef = db.collection("users").doc(uid);
  const [typesSnap, beansSnap, brewsSnap] = await Promise.all([
    userRef.collection("coffeeTypes").get(),
    userRef.collection("beans").get(),
    userRef.collection("coffees").get(),
  ]);
  const beans = beansSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const brews = brewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const ops = [];
  const now = nowIso();
  const changes = [];
  const unrecognised = new Set();
  let linkedBeans = 0;
  let linkedBrews = 0;

  typesSnap.docs.forEach((typeDoc) => {
    const type = typeDoc.data();
    const oldOrigin = clean(type.origin);
    if (!oldOrigin) return;
    if (clean(type.originMicroRegion)) return;
    const split = splitOriginValue(oldOrigin);
    if (!split) {
      if (!getOriginMacroRegion(oldOrigin)) unrecognised.add(oldOrigin);
      return;
    }

    changes.push({ name: clean(type.name) || clean(type.farmer) || typeDoc.id, oldOrigin, ...split });
    ops.push({
      type: "update",
      ref: typeDoc.ref,
      data: { origin: split.country, originMicroRegion: split.microRegion, updatedAt: now },
    });

    const beanIds = new Set();
    beans
      .filter((bean) => bean.coffeeTypeId === typeDoc.id)
      .forEach((bean) => {
        beanIds.add(bean.id);
        if (clean(bean.origin) !== oldOrigin) return;
        linkedBeans += 1;
        ops.push({ type: "update", ref: userRef.collection("beans").doc(bean.id), data: { origin: split.country } });
      });
    brews
      .filter((brew) => brew.beanId && beanIds.has(brew.beanId) && clean(brew.origin) === oldOrigin)
      .forEach((brew) => {
        linkedBrews += 1;
        ops.push({ type: "update", ref: userRef.collection("coffees").doc(brew.id), data: { origin: split.country } });
      });
  });

  const committed = await commitOps(db, ops, apply);
  return { changes, unrecognised: [...unrecognised].sort(), linkedBeans, linkedBrews, ops: ops.length, committed };
}

async function main() {
  const args = parseCommonArgs(process.argv.slice(2), DEFAULT_PROJECT_ID);
  if (args.help) {
    printCommonUsage(SCRIPT, "Split coffee origins like \"Yirgacheffe, Ethiopia\" into origin (country) and originMicroRegion.");
    process.exit(0);
  }

  const db = initDb(args.projectId);
  const userIds = await listTargetUserIds(db, args);
  const mode = args.apply ? "apply" : "dry-run";

  for (const uid of userIds) {
    const result = await processUser(db, uid, args.apply);
    console.log(`\n[${mode}] uid=${uid}`);
    result.changes.forEach((change) => {
      console.log(`  ${change.name}: "${change.oldOrigin}" -> country "${change.country}", micro-region "${change.microRegion}"`);
    });
    if (result.unrecognised.length) {
      console.log(`  Left as is, no known country: ${result.unrecognised.map((v) => `"${v}"`).join(", ")}`);
    }
    console.log(
      `  coffees=${result.changes.length} bags=${result.linkedBeans} brews=${result.linkedBrews} writeOps=${result.ops}`
    );
  }
  console.log(`\nMode: ${mode} · Project: ${args.projectId}`);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
