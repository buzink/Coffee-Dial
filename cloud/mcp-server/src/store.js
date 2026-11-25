// Firestore access for one user. Every path the server touches is built here, under
// users/{uid}. No tool gets a Firestore reference from anywhere else, so a tool cannot reach a
// path outside the signed-in user's tree.

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { ValidationError } from './errors.js';

// Subcollections of users/{uid} that the server may use. mcpLimits holds the write counter.
export const DATA_COLLECTIONS = Object.freeze(['coffeeTypes', 'beans', 'coffees', 'brewGraphs', 'gear']);
const ALLOWED_COLLECTIONS = new Set([...DATA_COLLECTIONS, 'mcpLimits']);

const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DOC_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function assertUid(uid) {
  if (typeof uid !== 'string' || !UID_PATTERN.test(uid)) {
    throw new Error('Refusing to build a Firestore path for an invalid uid');
  }
}

export function createFirebase(projectId) {
  const app = getApps()[0] || initializeApp({ projectId });
  return { db: getFirestore(app), auth: getAuth(app) };
}

export class Store {
  constructor(db, uid) {
    assertUid(uid);
    this.db = db;
    this.uid = uid;
    this.root = db.collection('users').doc(uid);
  }

  collection(name) {
    if (!ALLOWED_COLLECTIONS.has(name)) throw new Error(`Collection is not allowed: ${name}`);
    return this.root.collection(name);
  }

  doc(name, id) {
    if (typeof id !== 'string' || !DOC_ID_PATTERN.test(id)) {
      throw new ValidationError('id must be a Firestore document id (letters, digits, - and _)');
    }
    return this.collection(name).doc(id);
  }

  async listAll(name) {
    const snap = await this.collection(name).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}
