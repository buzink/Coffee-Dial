import { BREW_GRAPH_FIELDS, encodeBrewGraphDoc, splitBrewGraph } from '../../core/brew-graphs.js';

export const createBrewsRepo = ({ dataService, getCurrentUser }) => {
    const { db, doc, collection, addDoc, updateDoc, deleteDoc, writeBatch, deleteField } = dataService || {};
    if (!db || !doc || !collection || !addDoc || !updateDoc || !deleteDoc || !writeBatch || !deleteField) {
        throw new Error('createBrewsRepo requires dataService { db, doc, collection, addDoc, updateDoc, deleteDoc, writeBatch, deleteField }');
    }
    if (typeof getCurrentUser !== 'function') {
        throw new Error('createBrewsRepo requires getCurrentUser');
    }

    const requireUid = () => {
        const uid = getCurrentUser()?.uid;
        if (!uid) throw new Error('User not signed in');
        return uid;
    };

    const graphRef = (uid, brewId) => doc(db, 'users', uid, 'brewGraphs', brewId);

    // Scale captures never go into the brew document: they are written to the brew's graph
    // document in the same batch, so the brew and its graph cannot get out of step.
    const addCoffee = async (payload) => {
        const uid = requireUid();
        const { brew, graph } = splitBrewGraph(payload);
        if (!graph) {
            const ref = await addDoc(collection(db, 'users', uid, 'coffees'), brew);
            return ref.id;
        }
        const ref = doc(collection(db, 'users', uid, 'coffees'));
        const batch = writeBatch(db);
        batch.set(ref, { ...brew, hasGraph: true });
        batch.set(graphRef(uid, ref.id), encodeBrewGraphDoc(graph));
        await batch.commit();
        return ref.id;
    };

    // A payload without capture samples leaves an existing graph untouched, as before.
    const updateCoffee = async (id, payload) => {
        const uid = requireUid();
        const { brew, graph } = splitBrewGraph(payload);
        const brewRef = doc(db, 'users', uid, 'coffees', id);
        if (!graph) {
            await updateDoc(brewRef, brew);
            return;
        }
        const brewUpdate = { ...brew, hasGraph: true };
        // Clear captures still stored inline by older versions of the app.
        BREW_GRAPH_FIELDS.forEach((field) => {
            brewUpdate[field] = deleteField();
        });
        const batch = writeBatch(db);
        batch.update(brewRef, brewUpdate);
        batch.set(graphRef(uid, id), encodeBrewGraphDoc(graph));
        await batch.commit();
    };

    const deleteCoffee = async (id) => {
        const uid = requireUid();
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', uid, 'coffees', id));
        batch.delete(graphRef(uid, id));
        await batch.commit();
    };

    const addBean = async (payload) => {
        const uid = requireUid();
        const ref = await addDoc(collection(db, 'users', uid, 'beans'), payload);
        return ref.id;
    };

    const updateBean = async (id, payload) => {
        const uid = requireUid();
        await updateDoc(doc(db, 'users', uid, 'beans', id), payload);
    };

    const addCoffeeType = async (payload) => {
        const uid = requireUid();
        const ref = await addDoc(collection(db, 'users', uid, 'coffeeTypes'), payload);
        return ref.id;
    };

    const addGear = async (payload) => {
        const uid = requireUid();
        const ref = await addDoc(collection(db, 'users', uid, 'gear'), {
            uid,
            ...payload
        });
        return ref.id;
    };

    return {
        addBean,
        addCoffee,
        addCoffeeType,
        addGear,
        deleteCoffee,
        updateBean,
        updateCoffee
    };
};
