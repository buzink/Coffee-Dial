import { formatCoffeeLabel } from '../../core/coffee-display.js';
import { getOriginMacroRegion } from '../../core/origin-regions.js';
import { formatAltitude } from '../../core/altitude.js';

export const createCoffeesVmModule = () => {
    const toTableRow = (type = {}) => {
        const roaster = type.roaster || 'Unknown';
        const name = type.name || '-';
        const farmer = type.farmer || '-';
        const origin = type.origin || '-';
        const originMicroRegion = type.originMicroRegion || '-';
        const originMacroRegion = getOriginMacroRegion(type.origin) || '-';
        const processing = type.processing || '-';
        const variety = type.variety || '-';
        const roast = type.roast || type.roastType || '-';
        const rating = parseInt(type.rating, 10) || 0;
        const createdAt = type.createdAt ? new Date(type.createdAt).toLocaleDateString() : '-';
        const decaf = !!type.decaf;
        return { createdAt, decaf, farmer, name, origin, originMacroRegion, originMicroRegion, processing, rating, roast, roaster, variety };
    };

    const toCardView = (type = {}) => {
        return {
            createdAt: type.createdAt ? new Date(type.createdAt).toLocaleDateString() : '-',
            farmer: type.farmer || 'Unknown',
            name: type.name || '',
            title: formatCoffeeLabel(type, 'Unknown'),
            imageUrl: type.imageUrl || type.imageURL || '',
            origin: type.origin || '-',
            originMicroRegion: type.originMicroRegion || '-',
            originMacroRegion: getOriginMacroRegion(type.origin) || '-',
            processing: type.processing || '-',
            rating: parseInt(type.rating, 10) || 0,
            roast: type.roast || type.roastType || '-',
            roaster: type.roaster || '',
            decaf: !!type.decaf,
            shopUrl: type.webshopUrl || type.shopUrl || '',
            tasteNotes: (type.tasteNotes || '').trim(),
            variety: type.variety || '-',
            altitude: formatAltitude(type.altitude)
        };
    };

    return {
        toCardView,
        toTableRow
    };
};
