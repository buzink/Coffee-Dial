export const createBrewFormActionsModule = ({
    dispatchCommand,
    applyGraphTogglePrefsForMethod
}) => {
    const openSelectedBeanForEdit = () => {
        const select = document.getElementById('savedBeanSelect');
        const beanId = select?.value;
        if (!beanId) return;
        dispatchCommand?.(
            'beans.openCardForEdit',
            { beanId, event: null },
            { source: 'brew-form-actions.openSelectedBeanForEdit' }
        );
    };

    const toggleDrinkOther = () => {
        const value = document.getElementById('drinkType')?.value;
        const input = document.getElementById('drinkOther');
        if (!input) return;
        if (value === 'Other') input.classList.remove('hidden');
        else input.classList.add('hidden');
    };

    const DEFAULT_DRINK_BY_METHOD = {
        Espresso: 'Flat White',
        V60: 'Filter Coffee',
        'Hario Switch': 'Filter Coffee',
        'Clever Dripper': 'Filter Coffee',
        Aeropress: 'Filter Coffee',
        'French Press': 'Filter Coffee',
        Chemex: 'Filter Coffee',
        'OXO Rapid Brewer': 'Soup americano'
    };

    // Picking a method fills in a fitting drink, but only while no drink is chosen yet.
    const applyDefaultDrinkForMethod = (method) => {
        const drinkSelect = document.getElementById('drinkType');
        const defaultDrink = DEFAULT_DRINK_BY_METHOD[method];
        if (!drinkSelect || !defaultDrink || drinkSelect.value) return;
        drinkSelect.value = defaultDrink;
        toggleDrinkOther();
    };

    const toggleMethodOther = () => {
        const value = document.getElementById('method')?.value;
        const input = document.getElementById('methodOther');
        if (input) {
            if (value === 'Other') input.classList.remove('hidden');
            else input.classList.add('hidden');
        }
        applyDefaultDrinkForMethod(value);
        applyGraphTogglePrefsForMethod?.();
    };

    const bindMethodOtherChangeListener = () => {
        const methodOtherInput = document.getElementById('methodOther');
        if (!methodOtherInput) return;
        if (methodOtherInput.dataset.graphMethodBound === 'true') return;
        methodOtherInput.dataset.graphMethodBound = 'true';
        methodOtherInput.addEventListener('change', () => {
            applyGraphTogglePrefsForMethod?.();
        });
    };

    return {
        bindMethodOtherChangeListener,
        openSelectedBeanForEdit,
        toggleDrinkOther,
        toggleMethodOther
    };
};
