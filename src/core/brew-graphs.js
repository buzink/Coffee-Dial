// Scale captures (the graph of a brew) are large: they made up ~97% of all brew data. They live
// in their own document, users/{uid}/brewGraphs/{brewId}, and are only read when a graph is
// actually shown. The brew document keeps a small `hasGraph` flag instead.
//
// Brews written before this change (or by a browser still running old cached code) carry the
// captures inline. Everything here accepts both shapes; inline data wins because it is newer.

export const BREW_GRAPH_FIELDS = [
    'scaleCapture',
    'scaleFlowCapture',
    'scaleRawCapture',
    'scale2Capture',
    'scale2FlowCapture',
    'scale2RawCapture'
];

const hasSamples = (capture) => !!(capture && Array.isArray(capture.samples) && capture.samples.length);

export const hasInlineBrewGraph = (brew) => !!brew && BREW_GRAPH_FIELDS.some((field) => hasSamples(brew[field]));

// True when the brew has a graph, whether or not its captures are loaded yet.
export const brewHasGraph = (brew) => !!brew && (brew.hasGraph === true || hasInlineBrewGraph(brew));

// Splits a brew payload into the part for the brew document and the part for the graph document.
// `graph` is null when the payload carries no capture samples.
export const splitBrewGraph = (payload = {}) => {
    const brew = { ...payload };
    const graph = {};
    let hasAnySamples = false;
    BREW_GRAPH_FIELDS.forEach((field) => {
        if (!(field in brew)) return;
        const value = brew[field];
        delete brew[field];
        if (value === undefined || value === null) return;
        graph[field] = value;
        if (hasSamples(value)) hasAnySamples = true;
    });
    return { brew, graph: hasAnySamples ? graph : null };
};

// A graph document stores the captures as one JSON string. Written as plain fields, Firestore
// would index every sample of every capture, which makes the write slow and, for a batch of
// brews, too large to commit.
const GRAPH_DOC_VERSION = 1;
export const encodeBrewGraphDoc = (graph) => ({ version: GRAPH_DOC_VERSION, payload: JSON.stringify(graph) });
export const decodeBrewGraphDoc = (data) => {
    if (!data) return {};
    if (typeof data.payload === 'string') {
        try {
            return pickGraphFields(JSON.parse(data.payload));
        } catch (_) {
            return {};
        }
    }
    return pickGraphFields(data);
};

function pickGraphFields(source = {}) {
    const out = {};
    BREW_GRAPH_FIELDS.forEach((field) => {
        if (source[field] !== undefined && source[field] !== null) out[field] = source[field];
    });
    return out;
}

export const createBrewGraphStore = ({ dataService, getOwnerUid } = {}) => {
    const { db, doc, getDoc } = dataService || {};
    if (!db || !doc || !getDoc) {
        throw new Error('createBrewGraphStore requires dataService { db, doc, getDoc }');
    }
    if (typeof getOwnerUid !== 'function') {
        throw new Error('createBrewGraphStore requires getOwnerUid');
    }

    // Keyed by owner, brew and the brew's updatedAt, so an edit made elsewhere is picked up.
    const cache = new Map();
    const cacheKey = (ownerUid, brew) => `${ownerUid}/${brew.id}/${brew.updatedAt || ''}`;

    const fetchGraph = (ownerUid, brew) => {
        const key = cacheKey(ownerUid, brew);
        if (!cache.has(key)) {
            const promise = getDoc(doc(db, 'users', ownerUid, 'brewGraphs', brew.id))
                .then((snap) => (snap.exists() ? decodeBrewGraphDoc(snap.data()) : {}))
                .catch((error) => {
                    cache.delete(key);
                    throw error;
                });
            cache.set(key, promise);
        }
        return cache.get(key);
    };

    // Returns the brew with its captures attached. Never throws: when the graph cannot be read
    // (offline and not cached, no permission) the brew comes back unchanged and `ok` is false.
    const withGraph = async (brew) => {
        if (!brew || !brew.id) return { brew, ok: true, loaded: false };
        if (hasInlineBrewGraph(brew) || brew.hasGraph !== true) return { brew, ok: true, loaded: false };
        const ownerUid = getOwnerUid();
        if (!ownerUid) return { brew, ok: false, loaded: false };
        try {
            const graph = await fetchGraph(ownerUid, brew);
            return { brew: { ...brew, ...graph }, ok: true, loaded: true };
        } catch (error) {
            console.warn(`Could not load the graph for brew ${brew.id}.`, error);
            return { brew, ok: false, loaded: false };
        }
    };

    const loadBrewWithGraph = async (brew) => (await withGraph(brew)).brew;

    // Loads graphs for several brews, a few at a time. `failed` counts graphs that could not be read.
    const loadBrewsWithGraphs = async (brews = [], { concurrency = 6 } = {}) => {
        const list = Array.isArray(brews) ? brews : [];
        const result = new Array(list.length);
        let failed = 0;
        let next = 0;
        const worker = async () => {
            while (next < list.length) {
                const index = next;
                next += 1;
                const outcome = await withGraph(list[index]);
                if (!outcome.ok) failed += 1;
                result[index] = outcome.brew;
            }
        };
        await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
        return { brews: result, failed };
    };

    return { withGraph, loadBrewWithGraph, loadBrewsWithGraphs };
};
