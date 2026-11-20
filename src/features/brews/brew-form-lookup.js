import { buildBagOptionsHtml } from './bag-options.js';
import { formatOriginLabel } from '../../core/origin-regions.js';
import { isGrinderGear } from '../../core/brew-fields.js';
import { formatCoffeeLabel } from '../../core/coffee-display.js';
export const createBrewFormLookupModule = ({
    getBeans,
    getCoffeeTypes,
    getGasItems,
    getBeanCoffeeTypeDisplay,
    updateCoffeeDetailsTitle
}) => {
    const setCoffeeTypeFieldState = (locked) => {
        const fieldIds = ['roaster', 'farmer', 'origin', 'variety', 'processing', 'roastType'];
        fieldIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.disabled = locked;
            el.classList.toggle('cursor-not-allowed', locked);
            el.classList.toggle('opacity-70', locked);
        });
    };

    // While a brew is being edited every bag can be chosen, grouped by Open/Frozen/Finished;
    // live updates during the edit keep that full list. A new brew only offers open bags.
    const updateBeanDropdown = ({ includeAll } = {}) => {
        const select = document.getElementById('savedBeanSelect');
        if (!select) return;
        const showAll = includeAll ?? Boolean(document.getElementById('formContainer')?.classList.contains('editing-mode'));

        const formatRoastDate = (value) => {
            if (!value) return '';
            const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
            if (isNaN(dateObj)) return '';
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const yy = String(dateObj.getFullYear()).slice(-2);
            return `${dd}-${mm}-${yy}`;
        };
        const getLabel = (bean) => {
            const display = getBeanCoffeeTypeDisplay(bean);
            const roaster = display.roaster !== '-' ? display.roaster : 'Unknown';
            const coffee = formatCoffeeLabel(display, '');
            const farmer = coffee ? ` - ${coffee}` : '';
            const roastDate = formatRoastDate(bean.openedDate);
            const roastDateLabel = roastDate ? ` (${roastDate})` : '';
            return `${roaster}${farmer}${roastDateLabel}`;
        };

        const currentValue = select.value;
        select.innerHTML = buildBagOptionsHtml({
            beans: getBeans().filter((bean) => showAll || (!bean.archived && !bean.frozen)),
            getLabel,
            emptyLabel: '-- create new bag and coffee --',
            grouped: showAll
        });

        if (currentValue) {
            const existing = [...select.options].some((opt) => opt.value === currentValue);
            if (existing) select.value = currentValue;
        }
    };

    const updateCoffeeTypeSelectors = () => {
        const select = document.getElementById('beanEditCoffeeType');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="__new__">-- create new coffee --</option>';

        const uniqueTypes = new Map();
        getCoffeeTypes().forEach((type) => {
            if (type?.id && !uniqueTypes.has(type.id)) uniqueTypes.set(type.id, type);
        });

        [...uniqueTypes.values()]
            .sort((a, b) => (a.roaster || '').localeCompare(b.roaster || ''))
            .forEach((type) => {
                const option = document.createElement('option');
                option.value = type.id;
                const roaster = type.roaster || 'Unknown';
                const coffee = formatCoffeeLabel(type, '');
                const farmer = coffee ? ` - ${coffee}` : '';
                const roast = type.roast ? ` (${type.roast})` : '';
                option.text = `${roaster}${farmer}${roast}`;
                select.appendChild(option);
            });

        if (currentValue) select.value = currentValue;
    };

    const fillBeanDetails = (beanId) => {
        const editBtn = document.getElementById('savedBeanEditBtn');
        if (!beanId) {
            const roaster = document.getElementById('roaster');
            const farmer = document.getElementById('farmer');
            const origin = document.getElementById('origin');
            const variety = document.getElementById('variety');
            const processing = document.getElementById('processing');
            const roastType = document.getElementById('roastType');

            if (roaster) roaster.value = '';
            if (farmer) farmer.value = '';
            if (origin) origin.value = '';
            if (variety) variety.value = '';
            if (processing) processing.value = '';
            if (roastType) roastType.value = '';

            setCoffeeTypeFieldState(false);
            updateCoffeeDetailsTitle();
            if (editBtn) editBtn.disabled = true;
            return;
        }

        const beans = getBeans();
        const bean = beans.find((b) => b.id === beanId);
        if (!bean) {
            if (editBtn) editBtn.disabled = true;
            return;
        }

        const coffeeTypes = getCoffeeTypes();
        const type = bean.coffeeTypeId ? coffeeTypes.find((ct) => ct.id === bean.coffeeTypeId) : null;
        const source = type || {};

        const roaster = document.getElementById('roaster');
        const farmer = document.getElementById('farmer');
        const origin = document.getElementById('origin');
        const variety = document.getElementById('variety');
        const processing = document.getElementById('processing');
        const roastType = document.getElementById('roastType');

        if (roaster) roaster.value = source.roaster || '';
        if (farmer) farmer.value = source.farmer || '';
        // A coffee's fields are locked (and not saved with the brew), so the origin can show the micro-region too.
        if (origin) origin.value = type ? formatOriginLabel(type) : '';
        if (variety) variety.value = source.variety || '';
        if (processing) processing.value = source.processing || '';
        if (roastType) roastType.value = source.roast || source.roastType || '';

        // The coffee details belong to the bag's coffee: shown here, changed on the coffee card.
        setCoffeeTypeFieldState(true);
        updateCoffeeDetailsTitle();
        if (editBtn) editBtn.disabled = false;

        ['roaster', 'farmer', 'origin', 'variety', 'processing', 'roastType'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.add('ai-flash-effect');
            setTimeout(() => el.classList.remove('ai-flash-effect'), 1000);
        });
    };

    const updateAutocompleteLists = () => {
        const types = getCoffeeTypes();
        const uniqueOf = (values) => [...new Set(values.map((v) => (v || '').toString().trim()).filter(Boolean))].sort();
        const uniqueRoasters = uniqueOf(types.map((t) => t.roaster));
        const uniqueFarmers = uniqueOf(types.map((t) => t.farmer));
        const uniqueOrigins = uniqueOf(types.map((t) => t.origin));
        const uniqueGrinders = uniqueOf((getGasItems?.() || []).filter(isGrinderGear).map((g) => g.name));

        const populate = (id, values) => {
            const list = document.getElementById(id);
            if (list) list.innerHTML = values.map((v) => `<option value="${v}"></option>`).join('');
        };

        populate('roasterList', uniqueRoasters);
        populate('farmerList', uniqueFarmers);
        populate('originList', uniqueOrigins);
        populate('grinderList', uniqueGrinders);
    };

    return {
        updateBeanDropdown,
        updateCoffeeTypeSelectors,
        fillBeanDetails,
        updateAutocompleteLists
    };
};
