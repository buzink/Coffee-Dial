// A brew holds only brew data plus links: beanId (its bag, which links its coffee) and
// gearIds. Coffee details come from the coffee, the grinder from the linked gear.

const COFFEE_KEYS = new Set(['roaster', 'origin', 'farmer', 'variety', 'processing', 'roastType']);

const clean = (value) => {
    const text = (value ?? '').toString().trim();
    return text && text !== '-' ? text : '';
};

export const isGrinderGear = (item) => (item?.type || '').toString().trim().toLowerCase() === 'grinder';

// Name of the first grinder among the brew's linked gear, or ''.
export const getBrewGrinderName = (brew, gasItems = []) => {
    const ids = Array.isArray(brew?.gearIds) ? brew.gearIds : [];
    if (!ids.length) return '';
    const byId = new Map((gasItems || []).map((item) => [item.id, item]));
    for (const id of ids) {
        const item = byId.get(id);
        if (item && isGrinderGear(item)) return clean(item.name);
    }
    return '';
};

// Value of a filterable/sortable brew field, coffee fields read from the brew's coffee.
export const getBrewFieldValue = (brew, key, { getCoffeeTypeDisplay, gasItems = [] } = {}) => {
    if (COFFEE_KEYS.has(key)) {
        const display = typeof getCoffeeTypeDisplay === 'function' ? getCoffeeTypeDisplay(brew) : null;
        return clean(display?.[key]);
    }
    if (key === 'grinder') return getBrewGrinderName(brew, gasItems);
    return brew?.[key];
};

// Fields that used to be copied onto brews and bags; they live on the coffee (and the
// grinder on gear) now, so they are dropped whenever a brew or bag is copied or saved.
export const BREW_DUPLICATE_FIELDS = ['roaster', 'farmer', 'origin', 'originMicroRegion', 'variety', 'processing', 'roastType', 'roast', 'beanType', 'name', 'decaf', 'grinder'];
export const BAG_DUPLICATE_FIELDS = ['roaster', 'farmer', 'origin', 'originMicroRegion', 'variety', 'processing', 'roastType', 'roast', 'name', 'decaf'];
export const withoutFields = (obj, fields) => {
    const copy = { ...(obj || {}) };
    fields.forEach((field) => delete copy[field]);
    return copy;
};
