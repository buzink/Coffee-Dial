import { withDetectedDecaf } from '../../core/coffee-decaf.js';
import { isDraftItem, setCardAddingMode, toSavedFields, withoutDrafts } from '../../core/draft-items.js';

export const createBeansCardFormModule = ({
    getCurrentUser,
    getCurrentView,
    getCurrentBeanCardId,
    getBeans,
    getCoffeeTypes,
    setBeansState,
    computeBeansLeft,
    updateCoffeeTypeSelectors,
    dataService,
    dispatchCommand,
    closeBeanCard = () => {},
    renderBeansTable = () => {}
}) => {
    const { db, doc, collection, setDoc, updateDoc } = dataService || {};
    if (!db || !doc || !collection || !setDoc || !updateDoc) {
        throw new Error('createBeansCardFormModule requires dataService { db, doc, collection, setDoc, updateDoc }');
    }
    const setBeanEditCoffeeTypeFieldState = (locked) => {
        const fieldIds = [
            'beanEditFarmer',
            'beanEditRoaster',
            'beanEditOrigin',
            'beanEditProcessing',
            'beanEditVariety',
            'beanEditRoastType'
        ];

        // The coffee's own fields can only be filled in for a new coffee; for an existing
        // coffee they are hidden (they are edited on the coffee itself).
        fieldIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.disabled = locked;
            el.parentElement?.classList.toggle('hidden', locked);
        });
    };

    const applyBeanEditCoffeeType = (typeId) => {
        const clearFields = () => {
            document.getElementById('beanEditFarmer').value = '';
            document.getElementById('beanEditRoaster').value = '';
            document.getElementById('beanEditOrigin').value = '';
            document.getElementById('beanEditProcessing').value = '';
            document.getElementById('beanEditVariety').value = '';
            document.getElementById('beanEditRoastType').value = '';
        };

        const editBtn = document.getElementById('beanEditCoffeeTypeEditBtn');
        if (editBtn) editBtn.disabled = !typeId || typeId === '__new__';

        if (!typeId || typeId === '__new__') {
            clearFields();
            setBeanEditCoffeeTypeFieldState(false);
            return;
        }

        const type = getCoffeeTypes().find((ct) => ct.id === typeId);
        if (!type) {
            clearFields();
            setBeanEditCoffeeTypeFieldState(true);
            return;
        }

        document.getElementById('beanEditFarmer').value = type.farmer || '';
        document.getElementById('beanEditRoaster').value = type.roaster || '';
        document.getElementById('beanEditOrigin').value = type.origin || '';
        document.getElementById('beanEditProcessing').value = type.processing || '';
        document.getElementById('beanEditVariety').value = type.variety || '';
        document.getElementById('beanEditRoastType').value = type.roast || type.roastType || '';
        setBeanEditCoffeeTypeFieldState(true);
    };

    const enterBeanEditMode = () => {
        const beanCardId = getCurrentBeanCardId();
        if (!beanCardId) return;
        const bean = getBeans().find((b) => b.id === beanCardId);
        if (!bean) return;

        updateCoffeeTypeSelectors();

        const toInputDate = (value) => {
            if (!value) return '';
            const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
            if (isNaN(dateObj)) return '';
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        const coffeeTypeSelect = document.getElementById('beanEditCoffeeType');
        coffeeTypeSelect.value = bean.coffeeTypeId || '__new__';
        applyBeanEditCoffeeType(coffeeTypeSelect.value);
        coffeeTypeSelect.onchange = (event) => {
            applyBeanEditCoffeeType(event.target.value);
        };
        document.getElementById('beanEditStock').value = bean.stock ?? '';
        document.getElementById('beanEditPrice').value = bean.price ?? '';
        document.getElementById('beanEditOpenedDate').value = toInputDate(bean.openedDate);
        document.getElementById('beanEditFrozenDate').value = toInputDate(bean.frozenDate);
        document.getElementById('beanEditRoastDate').value = toInputDate(bean.roastDate);
        document.getElementById('beanEditArchivedDate').value = toInputDate(bean.archivedDate);
        document.getElementById('beanEditFrozen').checked = !!bean.frozen;
        document.getElementById('beanEditArchived').checked = !!bean.archived;

        setCardAddingMode('beanCardOverlay', isDraftItem(bean));
        document.getElementById('beanCardView').classList.add('hidden');
        document.getElementById('beanCardEdit').classList.remove('hidden');
        document.getElementById('beanCardEditBtn').classList.add('hidden');
        document.getElementById('beanCardMenuBtn').classList.add('hidden');
        document.getElementById('beanCardActionMenu').classList.add('hidden');
    };

    const openCoffeeFromBeanEdit = () => {
        const typeId = document.getElementById('beanEditCoffeeType')?.value;
        if (!typeId || typeId === '__new__') return;
        dispatchCommand?.('coffees.openCardForEdit', { id: typeId, event: null });
    };

    // Discard on a new bean: it was never saved, so it goes away with its card.
    const discardDraftBeans = () => {
        setCardAddingMode('beanCardOverlay', false);
        if (getBeans().some(isDraftItem)) setBeansState(withoutDrafts(getBeans()));
    };

    // Back to the card's view mode (also used each time the card opens).
    const resetBeanEditMode = () => {
        setCardAddingMode('beanCardOverlay', false);
        document.getElementById('beanCardEdit').classList.add('hidden');
        document.getElementById('beanCardView').classList.remove('hidden');
        document.getElementById('beanCardEditBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
        document.getElementById('beanCardMenuBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
    };

    // Cancel / Discard button: a new bean is discarded with its card.
    const cancelBeanEditMode = () => {
        const current = getBeans().find((b) => b.id === getCurrentBeanCardId());
        if (isDraftItem(current)) {
            closeBeanCard(null);
            discardDraftBeans();
            return;
        }
        resetBeanEditMode();
    };

    const saveBeanCardEdits = async () => {
        const user = getCurrentUser();
        const beanCardId = getCurrentBeanCardId();
        if (!user || !beanCardId) return;

        const stockValRaw = document.getElementById('beanEditStock').value;
        const stockVal = stockValRaw === '' ? null : parseFloat(stockValRaw);
        const priceValRaw = document.getElementById('beanEditPrice').value;
        const priceVal = priceValRaw === '' ? null : parseFloat(priceValRaw);
        const openedDateVal = document.getElementById('beanEditOpenedDate').value;
        const frozenDateVal = document.getElementById('beanEditFrozenDate').value;
        const roastDateVal = document.getElementById('beanEditRoastDate').value;
        const frozenChecked = document.getElementById('beanEditFrozen').checked;
        const archivedChecked = document.getElementById('beanEditArchived').checked;
        const nowIso = new Date().toISOString();
        const baseBean = getBeans().find((b) => b.id === beanCardId);
        const archivedDateVal = archivedChecked
            ? (baseBean?.archived ? (baseBean.archivedDate || nowIso) : nowIso)
            : (baseBean?.archivedDate || null);

        let coffeeTypeIdVal = document.getElementById('beanEditCoffeeType').value || '__new__';
        if (coffeeTypeIdVal === '__new__') {
            const bean = getBeans().find((b) => b.id === beanCardId);
            const typeData = withDetectedDecaf({
                uid: user.uid,
                roaster: document.getElementById('beanEditRoaster').value || '',
                farmer: document.getElementById('beanEditFarmer').value || '',
                processing: document.getElementById('beanEditProcessing').value || '',
                origin: document.getElementById('beanEditOrigin').value || '',
                roast: document.getElementById('beanEditRoastType').value || '',
                variety: document.getElementById('beanEditVariety').value || '',
                rating: 0,
                webshopUrl: '',
                imageUrl: bean?.imageURL || '',
                tasteNotes: '',
                createdAt: nowIso,
                updatedAt: nowIso
            });
            const typeRef = doc(collection(db, 'users', user.uid, 'coffeeTypes'));
            await setDoc(typeRef, typeData);
            coffeeTypeIdVal = typeRef.id;
        }

        // The coffee fields on the card only create a new coffee; the bag stores the link.
        const updates = {
            coffeeTypeId: coffeeTypeIdVal,
            stock: stockVal,
            price: Number.isFinite(priceVal) ? priceVal : null,
            openedDate: openedDateVal ? new Date(openedDateVal).toISOString() : null,
            frozenDate: frozenDateVal ? new Date(frozenDateVal).toISOString() : null,
            roastDate: roastDateVal ? new Date(roastDateVal).toISOString() : null,
            archivedDate: archivedDateVal,
            frozen: frozenChecked,
            archived: archivedChecked,
            updatedAt: nowIso
        };

        if (stockVal !== null) {
            updates.beansLeft = computeBeansLeft({ ...baseBean, stock: stockVal });
        } else {
            updates.beansLeft = null;
        }

        try {
            const isNew = isDraftItem(baseBean);
            if (isNew) {
                const fields = { ...toSavedFields(baseBean), ...updates };
                await setDoc(doc(db, 'users', user.uid, 'beans', beanCardId), fields);
                setBeansState(getBeans().map((b) => (b.id === beanCardId ? { id: beanCardId, ...fields } : b)));
                renderBeansTable();
                await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});
            } else {
                await updateDoc(doc(db, 'users', user.uid, 'beans', beanCardId), updates);
                setBeansState(getBeans().map((b) => (b.id === beanCardId ? { ...b, ...updates } : b)));
            }
            resetBeanEditMode();
            dispatchCommand?.('beans.openCard', { beanId: beanCardId, event: null, keepNavigationOrder: false });
        } catch (err) {
            console.error('Error saving bean edits:', err);
            alert('Failed to save changes.');
        }
    };

    return {
        setBeanEditCoffeeTypeFieldState,
        applyBeanEditCoffeeType,
        enterBeanEditMode,
        openCoffeeFromBeanEdit,
        cancelBeanEditMode,
        resetBeanEditMode,
        discardDraftBeans,
        saveBeanCardEdits
    };
};
