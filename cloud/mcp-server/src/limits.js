// Abuse limits. Without an allowlist, any verified Google account can call the server, so writes
// are capped per user (applied writes per hour, counted in Firestore so every Cloud Run instance
// shares the count) and each document has a maximum size. Dry runs are not counted.

import { LimitError, ValidationError } from './errors.js';

const HOUR_MS = 60 * 60 * 1000;

export async function consumeWriteQuota(store, limitPerHour, now = Date.now()) {
  const ref = store.collection('mcpLimits').doc('writes');
  await store.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    let windowStart = Number(data.windowStart) || now;
    let count = Number(data.count) || 0;
    if (now - windowStart >= HOUR_MS) {
      windowStart = now;
      count = 0;
    }
    if (count >= limitPerHour) {
      throw new LimitError(`Write limit reached: ${limitPerHour} applied changes per hour. Try again later (MCP_WRITE_LIMIT_PER_HOUR sets the limit).`);
    }
    tx.set(ref, { windowStart, count: count + 1 });
  });
}

export function assertDocSize(data, maxBytes) {
  const size = Buffer.byteLength(JSON.stringify(data), 'utf8');
  if (size > maxBytes) {
    throw new ValidationError(`The document would be ${size} bytes; the limit is ${maxBytes} (MCP_MAX_DOC_BYTES).`);
  }
}
