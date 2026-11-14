// "Shadow table" for the home page: one small document holding everything the pinned tiles /
// coffee art cards need, so they can be drawn before the full collections have loaded.
// It lives in users/{uid}/private/home (owner-only) and is mirrored in localStorage so the
// tiles appear without any network round trip. It is rebuilt from the live data whenever
// brews, bags, coffees or gear change.

const SNAPSHOT_VERSION = 1;
const LOCAL_KEY_PREFIX = 'coffeeDial.homeSnapshot.';
// Scale captures make up almost all of a brew document and are not shown on tiles.
const HEAVY_BREW_FIELDS = ['scaleCapture', 'scaleFlowCapture', 'scaleRawCapture'];
const MAX_FIELD_CHARS = 4000;
const MAX_SNAPSHOT_CHARS = 600000;

const clean = (value) => (value || '').toString().toLowerCase().trim();

const slimBrew = (brew) => {
    const out = {};
    Object.keys(brew || {}).forEach((key) => {
        if (HEAVY_BREW_FIELDS.includes(key)) return;
        const value = brew[key];
        if (value && typeof value === 'object') {
            let size = 0;
            try {
                size = JSON.stringify(value).length;
            } catch (_) {
                return;
            }
            if (size > MAX_FIELD_CHARS) return;
        }
        out[key] = value;
    });
    return out;
};

const matchesBean = (bean, brew) =>
    clean(bean.roaster) === clean(brew.roaster) &&
    clean(bean.farmer) === clean(brew.farmer) &&
    clean(bean.origin) === clean(brew.origin) &&
    clean(bean.processing) === clean(brew.processing) &&
    clean(bean.variety) === clean(brew.variety) &&
    clean(bean.roastType) === clean(brew.roastType);

// Picks the subset of the full data that the home tiles (and the cards opened from them) use.
export const buildHomeSnapshot = ({ coffees = [], beans = [], coffeeTypes = [], gasItems = [], pinnedPrefs = null } = {}) => {
    // New items that are not saved yet (drafts) never go into the snapshot.
    gasItems = gasItems.filter((item) => !item?.isDraft);
    beans = beans.filter((bean) => !bean?.isDraft);
    coffeeTypes = coffeeTypes.filter((type) => !type?.isDraft);
    const pinnedBrews = coffees.filter((brew) => brew?.isActive).map(slimBrew);

    const beanIds = new Set();
    beans.forEach((bean) => {
        const isOpen = !bean.archived && !bean.frozen;
        const isLinked = pinnedBrews.some((brew) => brew.beanId === bean.id || (!brew.beanId && matchesBean(bean, brew)));
        if (isOpen || isLinked) beanIds.add(bean.id);
    });
    const snapshotBeans = beans.filter((bean) => beanIds.has(bean.id));

    const coffeeTypeIds = new Set();
    [...pinnedBrews, ...snapshotBeans].forEach((item) => {
        if (typeof item?.coffeeTypeId === 'string' && item.coffeeTypeId.trim()) coffeeTypeIds.add(item.coffeeTypeId);
    });
    const snapshotCoffeeTypes = coffeeTypes.filter((type) => coffeeTypeIds.has(type.id));

    return {
        version: SNAPSHOT_VERSION,
        coffees: pinnedBrews,
        beans: snapshotBeans,
        coffeeTypes: snapshotCoffeeTypes,
        gasItems,
        pinnedPrefs: pinnedPrefs && typeof pinnedPrefs === 'object' ? pinnedPrefs : null
    };
};

const isUsable = (snapshot) =>
    !!snapshot &&
    snapshot.version === SNAPSHOT_VERSION &&
    Array.isArray(snapshot.coffees) &&
    Array.isArray(snapshot.beans) &&
    Array.isArray(snapshot.coffeeTypes);

export const createHomeSnapshotStore = ({ dataService, getCurrentUser, storage = globalThis.localStorage } = {}) => {
    const { db, doc, getDoc, setDoc } = dataService || {};
    if (!db || !doc || !getDoc || !setDoc) {
        throw new Error('createHomeSnapshotStore requires dataService { db, doc, getDoc, setDoc }');
    }

    let lastSavedUid = null;
    let lastSavedJson = '';

    const getUid = () => getCurrentUser?.()?.uid || null;
    const homeRef = (uid) => doc(db, 'users', uid, 'private', 'home');

    const readLocal = (uid = getUid()) => {
        if (!uid) return null;
        try {
            const raw = storage?.getItem(`${LOCAL_KEY_PREFIX}${uid}`);
            if (!raw) return null;
            const snapshot = JSON.parse(raw);
            if (!isUsable(snapshot)) return null;
            lastSavedUid = uid;
            lastSavedJson = raw;
            return snapshot;
        } catch (_) {
            return null;
        }
    };

    const readCloud = async (uid = getUid()) => {
        if (!uid) return null;
        try {
            const snap = await getDoc(homeRef(uid));
            if (!snap.exists()) return null;
            const data = snap.data();
            const snapshot = typeof data?.payload === 'string' ? JSON.parse(data.payload) : null;
            return isUsable(snapshot) ? snapshot : null;
        } catch (error) {
            console.warn('Could not load the home snapshot from the cloud.', error);
            return null;
        }
    };

    // Writes only when the content changed. Returns true when something was written.
    const save = async (snapshot) => {
        const uid = getUid();
        if (!uid || !isUsable(snapshot)) return false;
        let json = '';
        try {
            json = JSON.stringify(snapshot);
        } catch (_) {
            return false;
        }
        if (json.length > MAX_SNAPSHOT_CHARS) {
            console.warn(`Home snapshot too large (${json.length} chars); not saved.`);
            return false;
        }
        if (uid === lastSavedUid && json === lastSavedJson) return false;
        lastSavedUid = uid;
        lastSavedJson = json;
        try {
            storage?.setItem(`${LOCAL_KEY_PREFIX}${uid}`, json);
        } catch (_) { /* storage full or unavailable: the cloud copy still works */ }
        try {
            // Stored as one string: the brew/bag objects contain values Firestore would otherwise
            // index field by field, which is slower to write and of no use here.
            await setDoc(homeRef(uid), { version: SNAPSHOT_VERSION, updatedAt: new Date().toISOString(), payload: json });
        } catch (error) {
            console.warn('Could not save the home snapshot to the cloud; kept on this device.', error);
        }
        return true;
    };

    return { readLocal, readCloud, save };
};
