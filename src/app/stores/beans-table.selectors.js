import { formatCoffeeTypeOption } from '../../core/coffee-display.js';

export const BEAN_FIELD_FILTERS = [
    { key: 'origin', label: 'Origin country' },
    { key: 'originMicroRegion', label: 'Micro-region' },
    { key: 'originMacroRegion', label: 'Macro-region' },
    { key: 'processing', label: 'Process' },
    { key: 'variety', label: 'Variety' }
];
export const BEAN_FIELD_FILTER_KEYS = BEAN_FIELD_FILTERS.map((item) => item.key);

export const DEFAULT_BEANS_FILTERS = {
    coffeeType: null,
    ...Object.fromEntries(BEAN_FIELD_FILTERS.map(({ key }) => [key, null])),
    decaf: null
};

export const createDefaultBeansFilters = () => ({ ...DEFAULT_BEANS_FILTERS });

const normalizeText = (value) => (value || '').toString().toLowerCase().trim();

export const selectBeansCoffeeTypeValues = (coffeeTypes = []) => {
    return coffeeTypes.map((type) => ({
        id: type.id,
        display: formatCoffeeTypeOption(type)
    }));
};

const cleanFieldValue = (value) => {
    const text = (value || '').toString().trim();
    return text && text !== '-' ? text : '';
};

export const selectBeansFieldFilterValues = ({ beans = [], key, getBeanCoffeeTypeDisplay }) => {
    const values = beans.map((bean) => cleanFieldValue(getBeanCoffeeTypeDisplay(bean)?.[key])).filter(Boolean);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
};

export const selectFilteredBeans = ({
    beans = [],
    searchTerm = '',
    coffeeTypeFilter = null,
    decafFilter = null,
    fieldFilters = {},
    getBeanCoffeeTypeDisplay
}) => {
    const normalizedSearch = normalizeText(searchTerm);
    const bySearch = !normalizedSearch
        ? [...beans]
        : beans.filter((bean) => {
            const coffeeDisplay = getBeanCoffeeTypeDisplay(bean);
            const haystack = [
                coffeeDisplay.roaster,
                coffeeDisplay.name,
                coffeeDisplay.farmer,
                coffeeDisplay.origin,
                coffeeDisplay.processing,
                coffeeDisplay.variety,
                coffeeDisplay.roastType
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(normalizedSearch);
        });

    const byCoffeeType = !coffeeTypeFilter ? bySearch : bySearch.filter((bean) => bean.coffeeTypeId === coffeeTypeFilter);
    const activeFieldFilters = BEAN_FIELD_FILTER_KEYS.filter((key) => fieldFilters?.[key]);
    const byFields = !activeFieldFilters.length ? byCoffeeType : byCoffeeType.filter((bean) => {
        const coffeeDisplay = getBeanCoffeeTypeDisplay(bean);
        return activeFieldFilters.every((key) => normalizeText(cleanFieldValue(coffeeDisplay[key])) === normalizeText(fieldFilters[key]));
    });
    if (!decafFilter) return byFields;
    return byFields.filter((bean) => {
        const coffeeDisplay = getBeanCoffeeTypeDisplay(bean);
        const status = coffeeDisplay.decaf ? 'Decaf' : 'Regular';
        return normalizeText(status) === normalizeText(decafFilter);
    });
};

export const selectBeansByStockGroups = ({ beans = [], getBeanCalculatedStock }) => {
    const beansWithStock = beans.map((bean) => ({ ...bean, calculatedStock: getBeanCalculatedStock(bean) }));

    const inStockBeans = beansWithStock
        .filter((bean) => !bean.archived && !bean.frozen && bean.calculatedStock !== null && bean.calculatedStock > 0)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const frozenBeans = beansWithStock
        .filter((bean) => !bean.archived && bean.frozen)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const otherBeans = beansWithStock
        .filter((bean) => bean.archived || (!bean.frozen && (bean.calculatedStock === null || bean.calculatedStock <= 0)))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return {
        beansWithStock,
        inStockBeans,
        frozenBeans,
        otherBeans
    };
};

export const selectBeanTableOrderIds = ({ beans = [], getBeanCalculatedStock }) => {
    const { inStockBeans, frozenBeans, otherBeans } = selectBeansByStockGroups({
        beans,
        getBeanCalculatedStock
    });
    return [...inStockBeans, ...frozenBeans, ...otherBeans].map((bean) => bean.id);
};
