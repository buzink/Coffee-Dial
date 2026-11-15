import { brewHasGraph } from '../../core/brew-graphs.js';
import { formatCoffeeLabel, formatCoffeeTypeOption } from '../../core/coffee-display.js';
import { getOriginMacroRegion } from '../../core/origin-regions.js';
import { getBrewFieldValue, getBrewGrinderName } from '../../core/brew-fields.js';

export const DEFAULT_ACTIVE_FILTERS = {
    bean: null,
    coffeeType: null,
    gear: null,
    hasGraph: null,
    method: null,
    temp: null,
    roastType: null,
    roaster: null,
    origin: null,
    originMicroRegion: null,
    originMacroRegion: null,
    farmer: null,
    variety: null,
    processing: null,
    decaf: null,
    drink: null,
    grinder: null
};

export const createDefaultActiveFilters = () => ({ ...DEFAULT_ACTIVE_FILTERS });

const normalizeText = (value) => (value || '').toString().toLowerCase();

const normalizeSortChain = (currentSort) => {
    if (Array.isArray(currentSort)) {
        return currentSort
            .map((item) => ({
                key: item?.key || null,
                direction: item?.direction === 'desc' ? 'desc' : 'asc'
            }))
            .filter((item) => !!item.key);
    }
    if (currentSort && typeof currentSort === 'object' && currentSort.key) {
        return [{
            key: currentSort.key,
            direction: currentSort.direction === 'desc' ? 'desc' : 'asc'
        }];
    }
    return [];
};

const getSortValue = (brew, key, getCoffeeTypeDisplay, gasItems) => {
    if (key === 'date') key = 'createdAt';
    if (key === 'farmer') return formatCoffeeLabel(getCoffeeTypeDisplay(brew), '');
    if (key === 'recipe') return Number(brew.ratio) || 0;
    if (key === 'decaf') return getCoffeeTypeDisplay(brew).decaf ? 1 : 0;
    return getBrewFieldValue(brew, key, { getCoffeeTypeDisplay, gasItems });
};

const NUMERIC_SORT_KEYS = new Set(['rating', 'time', 'temp', 'grind', 'recipe', 'ratio', 'weight']);
const DATE_SORT_KEYS = new Set(['createdAt', 'date', 'updatedAt', 'openedDate', 'roastDate']);
const normalizeSortPrimitive = (value, key) => {
    if (value === null || typeof value === 'undefined') return null;
    if (typeof value === 'object') {
        if (typeof value.toDate === 'function') {
            const date = value.toDate();
            return Number.isNaN(date?.getTime?.()) ? null : date.getTime();
        }
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value.getTime();
        }
    }
    if (DATE_SORT_KEYS.has(key)) {
        const parsedDate = new Date(value);
        if (!Number.isNaN(parsedDate.getTime())) return parsedDate.getTime();
    }
    if (NUMERIC_SORT_KEYS.has(key)) {
        const numeric = Number(value);
        if (!Number.isNaN(numeric)) return numeric;
    }
    return typeof value === 'string' ? value.toLowerCase() : value;
};

export const selectBrewsUniqueValuesForKey = ({ coffees = [], key, getCoffeeTypeDisplay, gasItems = [] }) => {
    const values = coffees.map((brew) => getBrewFieldValue(brew, key, { getCoffeeTypeDisplay, gasItems }));
    return [...new Set(values)].filter(Boolean).sort();
};

export const selectBrewsQuickFilterValues = ({ key, coffees = [], beans = [], coffeeTypes = [], gasItems = [], formatBeanOpenedDate, getCoffeeTypeDisplay }) => {
    if (key === 'decaf') {
        const beanById = new Map(beans.map((bean) => [bean.id, bean]));
        const typeById = new Map(coffeeTypes.map((type) => [type.id, type]));
        let hasDecaf = false;
        let hasRegular = false;
        coffees.forEach((brew) => {
            const bean = beanById.get(brew.beanId);
            const type = bean?.coffeeTypeId ? typeById.get(bean.coffeeTypeId) : null;
            const isDecaf = !!type?.decaf;
            if (isDecaf) hasDecaf = true;
            else hasRegular = true;
        });
        return [hasDecaf ? 'Decaf' : null, hasRegular ? 'Regular' : null].filter(Boolean);
    }
    if (key === 'hasGraph') {
        return ['Has graph'];
    }
    if (key === 'originMicroRegion' || key === 'originMacroRegion') {
        const beanById = new Map(beans.map((bean) => [bean.id, bean]));
        const typeById = new Map(coffeeTypes.map((type) => [type.id, type]));
        const values = coffees.map((brew) => {
            const bean = beanById.get(brew.beanId);
            const type = bean?.coffeeTypeId ? typeById.get(bean.coffeeTypeId) : null;
            if (key === 'originMicroRegion') return (type?.originMicroRegion || '').trim();
            return getOriginMacroRegion(type?.origin);
        });
        return [...new Set(values)].filter(Boolean).sort();
    }
    if (key === 'bean') {
        const typeById = new Map(coffeeTypes.map((type) => [type.id, type]));
        return beans.map((bean) => ({
            id: bean.id,
            display: formatBagOption(bean, typeById.get(bean.coffeeTypeId), formatBeanOpenedDate)
        }));
    }
    if (key === 'coffeeType') {
        return coffeeTypes.map((type) => ({
            id: type.id,
            display: formatCoffeeTypeOption(type)
        }));
    }
    if (key === 'gear') {
        const usedGearIds = new Set();
        coffees.forEach((brew) => {
            const gearIds = Array.isArray(brew.gearIds) ? brew.gearIds : [];
            gearIds.forEach((gearId) => {
                if (gearId) usedGearIds.add(gearId);
            });
        });
        return gasItems
            .filter((item) => usedGearIds.has(item.id))
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
            .map((item) => ({ id: item.id, display: item.name || 'Unnamed gear' }));
    }
    return selectBrewsUniqueValuesForKey({ coffees, key, getCoffeeTypeDisplay, gasItems });
};

// Bag option in filters: its coffee ("Roaster - Name - Farmer") and when it was opened.
export const formatBagOption = (bean, type, formatBeanOpenedDate) => {
    const opened = typeof formatBeanOpenedDate === 'function' ? formatBeanOpenedDate(bean?.openedDate) : '';
    return `${formatCoffeeTypeOption(type || {})}${opened ? ` (${opened})` : ''}`;
};

const hasBrewGraphData = (brew) => brewHasGraph(brew);

export const selectFilteredSortedBrews = ({
    coffees = [],
    searchTerm = '',
    activeFilters = {},
    currentSort = [],
    getCoffeeTypeDisplay,
    getCoffeeTypeForBrew,
    gasItems = []
}) => {
    let filtered = [...coffees];
    const term = normalizeText(searchTerm).trim();

    if (term) {
        filtered = filtered.filter((brew) => {
            const typeDisplay = getCoffeeTypeDisplay(brew);
            const searchable = [
                brew.method || '',
                brew.drink || '',
                brew.notes || '',
                brew.improve || '',
                getBrewGrinderName(brew, gasItems),
                typeDisplay.roaster || '',
                typeDisplay.name || '',
                typeDisplay.farmer || '',
                typeDisplay.origin || '',
                typeDisplay.variety || '',
                typeDisplay.processing || '',
                typeDisplay.roastType || ''
            ]
                .join(' ')
                .toLowerCase();
            return searchable.includes(term);
        });
    }

    const fieldMatches = (brew, key) =>
        !activeFilters[key] || getBrewFieldValue(brew, key, { getCoffeeTypeDisplay, gasItems }) === activeFilters[key];
    filtered = filtered.filter((brew) => {
        const coffeeType = getCoffeeTypeForBrew(brew);
        const typeId = coffeeType?.id || null;
        const needsTypeDisplay = activeFilters.originMicroRegion || activeFilters.originMacroRegion;
        const regionDisplay = needsTypeDisplay ? getCoffeeTypeDisplay(brew) : null;
        const micro = !activeFilters.originMicroRegion || normalizeText(regionDisplay.originMicroRegion) === normalizeText(activeFilters.originMicroRegion);
        const macro = !activeFilters.originMacroRegion || regionDisplay.originMacroRegion === activeFilters.originMacroRegion;

        const m = !activeFilters.method || brew.method === activeFilters.method;
        const t = !activeFilters.temp || String(brew.temp) === String(activeFilters.temp);
        const r = fieldMatches(brew, 'roastType');
        const rost = fieldMatches(brew, 'roaster');
        const orig = fieldMatches(brew, 'origin');
        const farm = fieldMatches(brew, 'farmer');
        const varr = fieldMatches(brew, 'variety');
        const proc = fieldMatches(brew, 'processing');
        const dr = !activeFilters.drink || brew.drink === activeFilters.drink;
        const gri = fieldMatches(brew, 'grinder');
        const decafStatus = coffeeType?.decaf ? 'Decaf' : 'Regular';
        const decafMatch = !activeFilters.decaf || normalizeText(decafStatus) === normalizeText(activeFilters.decaf);
        const gearMatch = !activeFilters.gear || (Array.isArray(brew.gearIds) && brew.gearIds.includes(activeFilters.gear));
        const graphMatch = !activeFilters.hasGraph || hasBrewGraphData(brew);
        const beanMatch = !activeFilters.bean || brew.beanId === activeFilters.bean;
        const typeMatch = !activeFilters.coffeeType || typeId === activeFilters.coffeeType;

        return m && t && r && rost && orig && micro && macro && farm && varr && proc && decafMatch && dr && gri && gearMatch && graphMatch && beanMatch && typeMatch;
    });

    const sortChain = normalizeSortChain(currentSort);
    if (sortChain.length) {
        filtered.sort((a, b) => {
            for (const sortItem of sortChain) {
                const va = normalizeSortPrimitive(getSortValue(a, sortItem.key, getCoffeeTypeDisplay, gasItems), sortItem.key);
                const vb = normalizeSortPrimitive(getSortValue(b, sortItem.key, getCoffeeTypeDisplay, gasItems), sortItem.key);
                if (va === null && vb !== null) return sortItem.direction === 'asc' ? -1 : 1;
                if (va !== null && vb === null) return sortItem.direction === 'asc' ? 1 : -1;
                if (va < vb) return sortItem.direction === 'asc' ? -1 : 1;
                if (va > vb) return sortItem.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    return filtered;
};

export const selectVisibleBrewOrderIds = ({ filteredSortedBrews = [], displayedCount = 0 }) => {
    const limit = Math.min(Math.max(0, displayedCount || 0), filteredSortedBrews.length);
    return filteredSortedBrews.slice(0, limit).map((brew) => brew.id);
};
