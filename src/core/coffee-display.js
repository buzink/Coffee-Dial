import { getOriginMacroRegion } from './origin-regions.js';

const cleanPart = (value) => {
    const text = (value || '').toString().trim();
    return text && text !== '-' ? text : '';
};

// "Name - Farmer", or whichever of the two is set; '-' when neither is.
export const formatCoffeeLabel = ({ name, farmer } = {}, fallback = '-') => {
    const parts = [cleanPart(name), cleanPart(farmer)].filter(Boolean);
    if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) parts.pop();
    return parts.join(' - ') || fallback;
};

// "Name - Farmer (Roaster)"; just the roaster when the coffee has no name or farmer.
export const formatCoffeeWithRoaster = (display = {}, fallback = '-') => {
    const label = formatCoffeeLabel(display, '');
    const roaster = cleanPart(display.roaster);
    if (label && roaster) return `${label} (${roaster})`;
    return label || roaster || fallback;
};

// Coffee option in filters: "Roaster - Name - Farmer".
export const formatCoffeeTypeOption = (type = {}) => {
    const label = formatCoffeeLabel(type, '');
    return `${cleanPart(type.roaster) || 'Unknown'}${label ? ` - ${label}` : ''}`;
};

// Table cell content: "Name - Farmer" with a decaf moon close beside it, roaster below.
export const formatCoffeeCellHtml = (display = {}) => {
    const roaster = cleanPart(display.roaster) || 'Unknown';
    const decafIcon = display.decaf
        ? '<i class="fa-solid fa-moon text-[10px] text-coffee-500 dark:text-[#a8a29e] pl-3" title="Decaf"></i>'
        : '';
    const label = formatCoffeeLabel(display);
    // Keep the moon on the line of the last word, so it never wraps on its own.
    const splitAt = label.lastIndexOf(' ') + 1;
    const nameHtml = decafIcon
        ? `${label.slice(0, splitAt)}<span class="whitespace-nowrap">${label.slice(splitAt)}${decafIcon}</span>`
        : label;
    return `<div>${nameHtml}</div><span class="text-xs text-coffee-500">${roaster}</span>`;
};

export const createCoffeeDisplayModule = ({ getBeans, getCoffeeTypes }) => {
    const getCoffeeTypeForBrew = (brew) => {
        if (!brew || !brew.beanId) return null;
        const bean = getBeans().find((b) => b.id === brew.beanId);
        if (!bean || !bean.coffeeTypeId) return null;
        return getCoffeeTypes().find((ct) => ct.id === bean.coffeeTypeId) || null;
    };

    const getCoffeeTypeDisplay = (brew) => {
        const type = getCoffeeTypeForBrew(brew);
        return {
            roaster: type?.roaster || brew?.roaster || '-',
            name: type?.name || '',
            farmer: type?.farmer || brew?.farmer || '-',
            origin: type?.origin || brew?.origin || '-',
            originMicroRegion: type?.originMicroRegion || '',
            originMacroRegion: getOriginMacroRegion(type?.origin || brew?.origin),
            processing: type?.processing || brew?.processing || '-',
            variety: type?.variety || brew?.variety || '-',
            roastType: type?.roast || type?.roastType || brew?.roastType || '-',
            imageUrl: type?.imageUrl || type?.imageURL || '',
            imageURL: type?.imageURL || type?.imageUrl || '',
            decaf: !!(type?.decaf || brew?.decaf)
        };
    };

    const getCoffeeTypeForBean = (bean) => {
        if (!bean || !bean.coffeeTypeId) return null;
        return getCoffeeTypes().find((ct) => ct.id === bean.coffeeTypeId) || null;
    };

    const getBeanCoffeeTypeDisplay = (bean) => {
        const type = getCoffeeTypeForBean(bean);
        return {
            roaster: type?.roaster || bean?.roaster || '-',
            name: type?.name || '',
            farmer: type?.farmer || bean?.farmer || '-',
            origin: type?.origin || bean?.origin || '-',
            originMicroRegion: type?.originMicroRegion || '',
            originMacroRegion: getOriginMacroRegion(type?.origin || bean?.origin),
            processing: type?.processing || bean?.processing || '-',
            variety: type?.variety || bean?.variety || '-',
            roastType: type?.roast || type?.roastType || bean?.roastType || '-',
            imageUrl: type?.imageUrl || type?.imageURL || '',
            imageURL: type?.imageURL || type?.imageUrl || '',
            decaf: !!(type?.decaf || bean?.decaf)
        };
    };

    return {
        getCoffeeTypeForBrew,
        getCoffeeTypeDisplay,
        getCoffeeTypeForBean,
        getBeanCoffeeTypeDisplay
    };
};
