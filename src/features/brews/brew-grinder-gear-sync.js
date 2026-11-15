export const createBrewGrinderGearSyncModule = ({ getGasItems, addGear }) => {
    const normalize = (value) => (value || '').toString().trim().toLowerCase();
    const isGrinderGear = (item) => (item?.type || '').toString().trim().toLowerCase() === 'grinder';

    const findAssociatedGrinderGearId = (gearIds = []) => {
        if (!Array.isArray(gearIds) || !gearIds.length) return null;
        const gasItems = Array.isArray(getGasItems?.()) ? getGasItems() : [];
        const gasById = new Map(gasItems.map((item) => [item.id, item]));
        for (const gearId of gearIds) {
            const item = gasById.get(gearId);
            if (item && isGrinderGear(item)) return item.id;
        }
        return null;
    };

    const findGrinderGearByName = (name) => {
        const target = normalize(name);
        if (!target) return null;
        const gasItems = Array.isArray(getGasItems?.()) ? getGasItems() : [];
        return gasItems.find((item) => isGrinderGear(item) && normalize(item.name) === target) || null;
    };

    const ensureGrinderGearAssociation = async (brewPayload) => {
        if (!brewPayload || typeof brewPayload !== 'object') return { createdGearName: '', gearId: null };
        const grinderName = (brewPayload.grinder || '').toString().trim();
        if (!grinderName) return { createdGearName: '', gearId: null };

        const currentGearIds = Array.isArray(brewPayload.gearIds) ? brewPayload.gearIds.filter(Boolean) : [];
        const associatedGrinderId = findAssociatedGrinderGearId(currentGearIds);
        if (associatedGrinderId) {
            brewPayload.gearIds = [...new Set(currentGearIds)];
            return { createdGearName: '', gearId: associatedGrinderId };
        }

        let createdGearName = '';
        let grinderGear = findGrinderGearByName(grinderName);
        if (!grinderGear && typeof addGear === 'function') {
            const nowIso = new Date().toISOString();
            const newGear = {
                name: grinderName,
                price: null,
                type: 'grinder',
                methods: [],
                imageUrl: '',
                purchasedDate: nowIso,
                archived: false,
                createdAt: nowIso,
                updatedAt: nowIso
            };
            const newId = await addGear(newGear);
            grinderGear = { id: newId, ...newGear };
            createdGearName = grinderName;
            const gasItems = Array.isArray(getGasItems?.()) ? getGasItems() : null;
            if (Array.isArray(gasItems) && !gasItems.find((item) => item.id === newId)) {
                gasItems.push(grinderGear);
            }
        }

        if (grinderGear?.id) {
            brewPayload.gearIds = [...new Set([...currentGearIds, grinderGear.id])];
        } else {
            brewPayload.gearIds = [...new Set(currentGearIds)];
        }
        return { createdGearName, gearId: grinderGear?.id || null };
    };

    // A grinder name typed on a brew: replaces the brew's linked grinder gear when it names
    // another grinder (found or created in gear), removes it when emptied. Brews never
    // store the name itself.
    const setTypedGrinder = async (brewPayload, typedName) => {
        const ids = Array.isArray(brewPayload?.gearIds) ? brewPayload.gearIds.filter(Boolean) : [];
        const gasById = new Map((Array.isArray(getGasItems?.()) ? getGasItems() : []).map((item) => [item.id, item]));
        const currentGrinder = ids.map((id) => gasById.get(id)).find((item) => item && isGrinderGear(item));
        if (normalize(typedName) === normalize(currentGrinder?.name)) {
            brewPayload.gearIds = [...new Set(ids)];
            return { createdGearName: '', gearId: currentGrinder?.id || null };
        }
        brewPayload.gearIds = ids.filter((id) => !isGrinderGear(gasById.get(id)));
        if (!normalize(typedName)) return { createdGearName: '', gearId: null };
        brewPayload.grinder = typedName.toString().trim();
        const result = await ensureGrinderGearAssociation(brewPayload);
        delete brewPayload.grinder;
        return result;
    };

    return {
        ensureGrinderGearAssociation,
        setTypedGrinder
    };
};
