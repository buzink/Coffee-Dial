import { getOriginMacroRegion } from '../../core/origin-regions.js';

export const DEFAULT_COFFEE_TYPES_FILTERS = {
    name: null,
    roaster: null,
    farmer: null,
    origin: null,
    originMicroRegion: null,
    originMacroRegion: null,
    processing: null,
    decaf: null,
    variety: null,
    roast: null
};

export const createDefaultCoffeeTypeFilters = () => ({ ...DEFAULT_COFFEE_TYPES_FILTERS });

const normalizeText = (value) => (value || '').toString().toLowerCase().trim();

// A coffee's value for a filter or sort key; the macro-region is worked out from the country.
export const getCoffeeTypeFieldValue = (type = {}, key) => {
    if (key === 'roast') return type.roast || type.roastType || '';
    if (key === 'originMacroRegion') return getOriginMacroRegion(type.origin);
    return type[key] || '';
};

export const selectCoffeeTypesQuickFilterValues = ({ key, coffeeTypes = [] }) => {
    if (key === 'decaf') {
        const hasDecaf = coffeeTypes.some((type) => !!type.decaf);
        const hasRegular = coffeeTypes.some((type) => !type.decaf);
        return [hasDecaf ? 'Decaf' : null, hasRegular ? 'Regular' : null].filter(Boolean);
    }
    const valueSource = coffeeTypes
        .map((type) => getCoffeeTypeFieldValue(type, key))
        .filter(Boolean);
    return [...new Set(valueSource)].sort();
};

export const selectFilteredSortedCoffeeTypes = ({
    coffeeTypes = [],
    searchValue = '',
    filters = {},
    sortKey = 'createdAt',
    sortDir = 'desc'
}) => {
    const normalizedSearch = normalizeText(searchValue);
    const hasSearch = normalizedSearch.length > 0;
    const uniqueCoffeeTypes = [...new Map(coffeeTypes.map((type, idx) => [type?.id || `__idx_${idx}`, type])).values()];

    const matchesQuickFilters = (type) => {
        return Object.entries(filters).every(([key, value]) => {
            if (!value) return true;
            if (key === 'decaf') {
                const status = type.decaf ? 'Decaf' : 'Regular';
                return normalizeText(status) === normalizeText(value);
            }
            const targetValue = getCoffeeTypeFieldValue(type, key);
            return normalizeText(targetValue) === normalizeText(value);
        });
    };

    const filteredTypes = uniqueCoffeeTypes.filter((type) => {
        const roaster = normalizeText(type.roaster);
        const name = normalizeText(type.name);
        const farmer = normalizeText(type.farmer);
        const origin = normalizeText(type.origin);
        const originMicroRegion = normalizeText(type.originMicroRegion);
        const originMacroRegion = normalizeText(getOriginMacroRegion(type.origin));
        const processing = normalizeText(type.processing);
        const variety = normalizeText(type.variety);
        const roast = normalizeText(type.roast || type.roastType);

        if (!matchesQuickFilters(type)) return false;
        if (!hasSearch) return true;
        return [name, roaster, farmer, origin, originMicroRegion, originMacroRegion, processing, variety, roast].join(' ').includes(normalizedSearch);
    });

    const getSortValue = (type, key) => {
        if (key === 'decaf') return type.decaf ? 1 : 0;
        if (key === 'roast') return type.roast || type.roastType || '';
        if (key === 'brews') return Number(type.brewsCount) || 0;
        if (key === 'bags') return Number(type.bagsCount) || 0;
        if (key === 'ground') return Number(type.groundKg) || 0;
        if (key === 'rating') return parseInt(type.rating, 10) || 0;
        if (key === 'createdAt') return type.createdAt || '';
        return getCoffeeTypeFieldValue(type, key);
    };

    return [...filteredTypes].sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        const aVal = getSortValue(a, sortKey);
        const bVal = getSortValue(b, sortKey);

        let primary;
        if (sortKey === 'rating' || sortKey === 'brews' || sortKey === 'bags' || sortKey === 'ground') {
            primary = (Number(aVal) || 0) - (Number(bVal) || 0);
        } else {
            primary = normalizeText(aVal).localeCompare(normalizeText(bVal));
        }

        if (primary === 0) {
            const aRoaster = normalizeText(a.roaster);
            const bRoaster = normalizeText(b.roaster);
            const aFarmer = normalizeText(a.farmer);
            const bFarmer = normalizeText(b.farmer);
            if (sortKey === 'roaster') {
                primary = aFarmer.localeCompare(bFarmer);
            } else if (sortKey === 'farmer') {
                primary = aRoaster.localeCompare(bRoaster);
            } else {
                primary = aRoaster.localeCompare(bRoaster) || aFarmer.localeCompare(bFarmer);
            }
        }
        return primary * dir;
    });
};
