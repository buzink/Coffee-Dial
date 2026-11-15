const resolveLinkedBeanId = ({ brew }) => brew?.beanId || null;

const sortByPinnedOrder = (a, b) => {
    const orderDelta = (a.customOrder || 0) - (b.customOrder || 0);
    if (orderDelta !== 0) return orderDelta;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
};

export const selectVisiblePinnedBrewOrderIds = ({
    coffees = [],
    beans = []
} = {}) => {
    const activeBrewsSorted = [...(Array.isArray(coffees) ? coffees : [])]
        .filter((brew) => brew?.isActive)
        .sort(sortByPinnedOrder);

    const grouped = new Map();
    activeBrewsSorted.forEach((brew) => {
        const beanId = resolveLinkedBeanId({ brew, beans });
        const beanKey = beanId || `no-bean-${brew.id}`;
        if (!grouped.has(beanKey)) grouped.set(beanKey, []);
        grouped.get(beanKey).push(brew.id);
    });

    return Array.from(grouped.values()).flat();
};
