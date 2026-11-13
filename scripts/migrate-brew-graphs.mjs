// Moves scale captures out of brew documents into users/{uid}/brewGraphs/{brewId}.
//
// Brew documents carried the full capture of every brew, which made up almost all of the data
// the app had to load. After this migration a brew keeps a small `hasGraph` flag and the
// captures are read only when a graph is shown. The app reads both shapes, so the script can be
// run again at any time (for instance after a browser with old cached code saved a brew).
import admin from "firebase-admin";
import {
  DEFAULT_PROJECT_ID,
  initDb,
  listTargetUserIds,
  parseCommonArgs,
  printCommonUsage,
} from "./admin-utils.mjs";

const SCRIPT = "scripts/migrate-brew-graphs.mjs";
const GRAPH_FIELDS = [
  "scaleCapture",
  "scaleFlowCapture",
  "scaleRawCapture",
  "scale2Capture",
  "scale2FlowCapture",
  "scale2RawCapture",
];
// A batch may hold 500 writes and 10 MB; captures are large, so size is the tighter limit.
const MAX_BATCH_BYTES = 1_500_000;
const MAX_BATCH_BREWS = 20;
// Same shape the app writes: see encodeBrewGraphDoc in src/core/brew-graphs.js.
const encodeGraphDoc = (graph) => ({version: 1, payload: JSON.stringify(graph)});

const hasSamples = (capture) =>
  !!(capture && Array.isArray(capture.samples) && capture.samples.length);

async function processUser(db, uid, apply) {
  const userRef = db.collection("users").doc(uid);
  const brewsSnap = await userRef.collection("coffees").get();

  const stats = {brews: brewsSnap.size, moved: 0, emptied: 0, bytesMoved: 0, bytesBefore: 0};
  const work = [];

  brewsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    stats.bytesBefore += JSON.stringify(data).length;
    const present = GRAPH_FIELDS.filter((field) => field in data);
    if (!present.length) return;

    const graph = {};
    present.forEach((field) => {
      if (data[field] !== null && data[field] !== undefined) graph[field] = data[field];
    });
    const withSamples = Object.values(graph).some(hasSamples);
    const brewUpdate = {};
    present.forEach((field) => {
      brewUpdate[field] = admin.firestore.FieldValue.delete();
    });

    if (withSamples) {
      brewUpdate.hasGraph = true;
      const bytes = JSON.stringify(graph).length;
      stats.moved += 1;
      stats.bytesMoved += bytes;
      work.push({brewRef: docSnap.ref, brewUpdate, graphRef: userRef.collection("brewGraphs").doc(docSnap.id), graph, bytes});
    } else {
      // Capture fields without samples: nothing to keep, just remove them.
      stats.emptied += 1;
      work.push({brewRef: docSnap.ref, brewUpdate, graphRef: null, graph: null, bytes: 0});
    }
  });

  if (apply) {
    let batch = db.batch();
    let batchBytes = 0;
    let batchBrews = 0;
    const flush = async () => {
      if (!batchBrews) return;
      await batch.commit();
      batch = db.batch();
      batchBytes = 0;
      batchBrews = 0;
    };
    for (const item of work) {
      if (batchBrews >= MAX_BATCH_BREWS || (batchBrews && batchBytes + item.bytes > MAX_BATCH_BYTES)) {
        await flush();
      }
      // The brew and its graph go in the same batch, so a brew never loses its captures.
      if (item.graphRef) batch.set(item.graphRef, encodeGraphDoc(item.graph));
      batch.update(item.brewRef, item.brewUpdate);
      batchBytes += item.bytes;
      batchBrews += 1;
    }
    await flush();
  }

  return stats;
}

async function main() {
  const args = parseCommonArgs(process.argv.slice(2), DEFAULT_PROJECT_ID);
  if (args.help) {
    printCommonUsage(SCRIPT, "Move scale captures from brew documents to brewGraphs documents.");
    return;
  }

  const db = initDb(args.projectId);
  const userIds = await listTargetUserIds(db, args);
  console.log(`${args.apply ? "APPLY" : "DRY RUN"} on project ${args.projectId}, ${userIds.length} user(s)`);

  const total = {brews: 0, moved: 0, emptied: 0, bytesMoved: 0, bytesBefore: 0};
  for (let i = 0; i < userIds.length; i += 1) {
    const stats = await processUser(db, userIds[i], args.apply);
    Object.keys(total).forEach((key) => {
      total[key] += stats[key];
    });
    console.log(
        `user ${i + 1}/${userIds.length}: ${stats.brews} brews, ${stats.moved} graphs ${args.apply ? "moved" : "to move"}, ` +
        `${stats.emptied} empty capture fields, ${(stats.bytesMoved / 1e6).toFixed(2)} of ${(stats.bytesBefore / 1e6).toFixed(2)} MB`,
    );
  }
  console.log(
      `total: ${total.brews} brews, ${total.moved} graphs ${args.apply ? "moved" : "to move"}, ${total.emptied} emptied, ` +
      `${(total.bytesMoved / 1e6).toFixed(2)} of ${(total.bytesBefore / 1e6).toFixed(2)} MB leaves the brew documents`,
  );
  if (!args.apply) console.log("Dry run only. Re-run with --apply to write.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
