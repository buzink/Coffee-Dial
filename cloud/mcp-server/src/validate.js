// Input shapes for the write tools. The Admin SDK bypasses the Firestore rules, so every field
// is checked here: type, range and length. Fields are also kept to their own entity:
// coffee details live on the coffee (coffeeTypes), bag details on the bag (beans), brew details
// on the brew (coffees), and a grinder is gear linked by gearIds. A field from another entity
// is refused with a hint, so a copy can never slip in.

import { z } from 'zod';
import { ValidationError } from './errors.js';

const text = (max) => z.string().trim().max(max);
const nullableText = (max) => text(max).nullable();
const amount = (max) => z.number().finite().min(0).max(max);
const nullableAmount = (max) => amount(max).nullable();
const rating = z.number().int().min(0).max(5);
const docId = z.string().trim().min(1).max(128);
const applyFlag = z.boolean().default(false);

const toIsoDate = (value) => {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
};
const isoDate = z.string().trim().max(40)
  .refine((value) => toIsoDate(value) !== null, 'must be a date, for example 2026-11-01')
  .transform((value) => toIsoDate(value));

const httpsUrl = z.string().trim().max(500).refine((value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, 'must be an https URL').nullable();

export const COFFEE_SHAPE = {
  id: docId.optional(),
  name: nullableText(200).optional(),
  roaster: nullableText(120).optional(),
  farmer: nullableText(120).optional(),
  origin: nullableText(120).optional(),
  originMicroRegion: nullableText(120).optional(),
  originMacroRegion: nullableText(120).optional(),
  variety: nullableText(120).optional(),
  processing: nullableText(120).optional(),
  roast: nullableText(120).optional(),
  decaf: z.boolean().optional(),
  rating: rating.optional(),
  tasteNotes: nullableText(2000).optional(),
  webshopUrl: httpsUrl.optional(),
  apply: applyFlag,
};

export const BAG_SHAPE = {
  id: docId.optional(),
  coffeeTypeId: docId.optional(),
  stock: nullableAmount(100000).optional(),
  price: nullableAmount(100000).optional(),
  shopUrl: httpsUrl.optional(),
  archived: z.boolean().optional(),
  frozen: z.boolean().optional(),
  openedDate: isoDate.nullable().optional(),
  archivedDate: isoDate.nullable().optional(),
  frozenDate: isoDate.nullable().optional(),
  roastDate: isoDate.nullable().optional(),
  apply: applyFlag,
};

export const BREW_SHAPE = {
  id: docId.optional(),
  beanId: docId.nullable().optional(),
  gearIds: z.array(docId).max(20).optional(),
  method: nullableText(80).optional(),
  grind: nullableAmount(1000).optional(),
  weight: nullableAmount(1000).optional(),
  ratio: nullableAmount(1000).optional(),
  time: nullableAmount(36000).optional(),
  temp: z.number().finite().min(0).max(120).nullable().optional(),
  drink: nullableText(80).optional(),
  notes: nullableText(5000).optional(),
  improve: nullableText(2000).optional(),
  rating: rating.optional(),
  firstDrip: nullableAmount(1000).optional(),
  maxFlow: nullableAmount(1000).optional(),
  avgFlow: nullableAmount(1000).optional(),
  createdAt: isoDate.optional(),
  apply: applyFlag,
};

export const GEAR_SHAPE = {
  id: docId.optional(),
  name: text(120).optional(),
  type: text(40).optional(),
  price: nullableAmount(100000).optional(),
  methods: z.array(text(80)).max(30).optional(),
  archived: z.boolean().optional(),
  purchasedDate: isoDate.nullable().optional(),
  apply: applyFlag,
};

const COFFEE_DETAILS = ['roaster', 'farmer', 'origin', 'originMicroRegion', 'originMacroRegion', 'variety', 'processing', 'roast', 'roastType', 'decaf', 'beanType', 'name'];
const BAG_DETAILS = ['coffeeTypeId', 'stock', 'price', 'shopUrl', 'archived', 'frozen', 'openedDate', 'archivedDate', 'frozenDate', 'roastDate'];
const BREW_DETAILS = ['beanId', 'gearIds', 'method', 'grind', 'weight', 'ratio', 'time', 'temp', 'drink', 'notes', 'improve', 'firstDrip', 'maxFlow', 'avgFlow', 'grinder'];

const hintFor = (fields, hint) => Object.fromEntries(fields.map((f) => [f, hint]));
const COFFEE_HINT = 'Coffee details belong on the coffee: change them with upsert_coffee and link the bag with coffeeTypeId.';
const BAG_HINT = 'Bag details belong on the bag: change them with upsert_bag.';
const BREW_HINT = 'Brew details belong on the brew: change them with upsert_brew.';
const GRINDER_HINT = 'A grinder is gear: pass its gear id in gearIds (see list_gear).';
const BEANS_LEFT_HINT = 'beansLeft is calculated from the brews: set stock on the bag instead.';

export const HINTS = {
  coffee: {
    ...hintFor(BAG_DETAILS, BAG_HINT),
    ...hintFor(BREW_DETAILS, BREW_HINT),
    beansLeft: BEANS_LEFT_HINT,
  },
  bag: {
    ...hintFor(COFFEE_DETAILS.filter((f) => f !== 'decaf'), COFFEE_HINT),
    decaf: COFFEE_HINT,
    ...hintFor(BREW_DETAILS, BREW_HINT),
    beansLeft: BEANS_LEFT_HINT,
  },
  brew: {
    ...hintFor(COFFEE_DETAILS, COFFEE_HINT),
    ...hintFor(BAG_DETAILS, BAG_HINT),
    grinder: GRINDER_HINT,
    beansLeft: BEANS_LEFT_HINT,
  },
  gear: {
    ...hintFor(COFFEE_DETAILS, COFFEE_HINT),
    beansLeft: BEANS_LEFT_HINT,
  },
};

// Parses write input for one entity. Unknown keys are refused, with a hint when the key belongs
// to another entity. `shape` is the entity's zod shape; `label` names it in messages.
export function parseWriteInput(args, { label, shape, hints }) {
  const known = new Set(Object.keys(shape));
  const input = args && typeof args === 'object' ? args : {};
  const unknown = Object.keys(input).find((key) => !known.has(key));
  if (unknown !== undefined) {
    const hint = hints[unknown];
    throw new ValidationError(hint
      ? `"${unknown}" does not belong on a ${label}. ${hint}`
      : `Unknown field "${unknown}" for a ${label}`);
  }
  const result = z.object(shape).safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
    throw new ValidationError(`Invalid ${label}: ${details}`);
  }
  return result.data;
}
