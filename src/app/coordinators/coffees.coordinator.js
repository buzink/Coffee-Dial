import { createCoffeeTypeCardModule } from '../../features/coffees/coffee-type-card.js';
import { createCoffeeTypesTableModule } from '../../features/coffees/coffee-types-table.js';
import { createCoffeesRepoModule } from '../../features/coffees/coffees.repo.js';
import { withDetectedDecaf } from '../../core/coffee-decaf.js';
import { createDraftId, withoutDrafts } from '../../core/draft-items.js';
import { showToast } from '../../core/notify.js';

export const createCoffeesCoordinator = ({
    dataService,
    storageService,
    imageCompression,
    removeCoffeeImageBackground,
    getCurrentUser,
    getCurrentView,
    getCurrentCoffeeTypeId,
    setCurrentCoffeeTypeId,
    getCoffees,
    getCoffeeTypes,
    getPinnedBrewsPreferences,
    setCoffeeTypesState,
    getCoffeeTypesSearch,
    setCoffeeTypesSearchState,
    getCoffeeTypesFilters,
    setCoffeeTypesFiltersState,
    getCoffeeTypesSortKey,
    setCoffeeTypesSortKeyState,
    getCoffeeTypesSortDir,
    setCoffeeTypesSortDirState,
    getBeans,
    setBeansState,
    getStarDisplay,
    openAppConfirm,
    updateCoffeeTypeSelectors,
    renderPinnedTiles,
    openLightbox,
    appCommands = null,
    appEvents = null
}) => {
    const repo = createCoffeesRepoModule({ dataService });
    const dispatchCommand = (commandName, payload) => {
        if (!appCommands?.dispatch) return undefined;
        return appCommands.dispatch(commandName, payload, { source: 'coffees.coordinator' });
    };
    const publishEvent = (eventName, payload) => {
        if (!appEvents?.publish) return;
        appEvents.publish(eventName, payload, { source: 'coffees.coordinator' });
    };
    const dispatchOnly = (commandName, payload) => {
        try {
            return dispatchCommand(commandName, payload);
        } catch (error) {
            console.warn(`[Coffees] Command "${commandName}" failed`, error);
            return undefined;
        }
    };
    let getFilteredSortedCoffeeTypes = () => [];
    let renderCoffeeTypesTable = () => {};
    let openCoffeeTypeCard = () => {};
    let closeCoffeeTypeCard = () => {};

    const openCoffeeTypes = () => {
        if (!getCurrentUser()) return alert('Please sign in.');
        document.getElementById('coffeeTypesPage').classList.remove('hidden');
        renderCoffeeTypesTable();
    };

    const closeCoffeeTypes = () => {
        document.getElementById('coffeeTypesPage').classList.add('hidden');
    };

    const createCoffeeTypeFromModal = async () => {
        const user = getCurrentUser();
        if (!user) return alert('Please sign in.');
        const nowIso = new Date().toISOString();
        const typeData = withDetectedDecaf({
            uid: user.uid,
            roaster: '',
            name: '',
            farmer: '',
            origin: '',
            originMicroRegion: '',
            processing: '',
            variety: '',
            altitude: '',
            roast: '',
            decaf: false,
            rating: 0,
            tasteNotes: '',
            webshopUrl: '',
            imageUrl: '',
            createdAt: nowIso,
            updatedAt: nowIso
        });

        // A draft: it is written only when the card's Save is clicked (saveCoffeeTypeEdits).
        const newType = { id: createDraftId(), ...typeData, isDraft: true };
        setCoffeeTypesState([...withoutDrafts(getCoffeeTypes()), newType]);
        // The card mounts lazily, so open it for edit in one command (open, then edit mode).
        await dispatchOnly('coffees.openCardForEdit', { id: newType.id, event: null });
    };

    // Copies a friend's coffee into the user's own coffees. The rating stays behind (it is the
    // friend's opinion). The photo is copied into the user's own storage, never linked: photos
    // are deleted by their URL, so a shared link would let the copy delete the friend's file.
    const COPIED_COFFEE_FIELDS = ['name', 'farmer', 'roaster', 'origin', 'originMicroRegion', 'processing', 'variety', 'altitude', 'roast', 'decaf', 'tasteNotes', 'webshopUrl'];
    const copyCoffeePhoto = async ({ uid, typeId, sourceUrl }) => {
        const { storage, ref, uploadBytes, getDownloadURL } = storageService || {};
        const { db, doc, updateDoc } = dataService || {};
        if (!storage || !ref || !uploadBytes || !getDownloadURL || !doc || !updateDoc) return;
        try {
            const response = await fetch(sourceUrl, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const photoRef = ref(storage, `photos/${uid}/coffee_type_${typeId}_${Date.now()}`);
            const snapshot = await uploadBytes(photoRef, blob, { contentType: blob.type || 'image/jpeg' });
            const imageUrl = await getDownloadURL(snapshot.ref);
            await updateDoc(doc(db, 'users', uid, 'coffeeTypes', typeId), { imageUrl, updatedAt: new Date().toISOString() });
        } catch (err) {
            // The coffee itself is already cloned; only the photo is missing.
            console.warn('[Coffees] Copying the photo of a cloned coffee failed', err);
        }
    };

    const cloneCoffeeTypeToMine = async (typeId) => {
        document.querySelectorAll('.action-menu').forEach((menu) => menu.classList.add('hidden'));
        const user = getCurrentUser();
        if (!user) return alert('Please sign in.');
        const type = getCoffeeTypes().find((ct) => ct.id === typeId);
        if (!type) return;
        const nowIso = new Date().toISOString();
        const data = { uid: user.uid, rating: 0, imageUrl: '', createdAt: nowIso, updatedAt: nowIso };
        COPIED_COFFEE_FIELDS.forEach((key) => {
            data[key] = key === 'decaf' ? !!type[key] : (type[key] || '');
        });
        try {
            const newRef = await repo.createCoffeeType({ uid: user.uid, data: withDetectedDecaf(data) });
            const label = type.name || type.farmer || 'coffee';
            showToast(`${label} cloned to My coffees.`);
            const sourceUrl = type.imageUrl || type.imageURL || '';
            if (sourceUrl) await copyCoffeePhoto({ uid: user.uid, typeId: newRef.id, sourceUrl });
        } catch (err) {
            console.error('Error cloning coffee:', err);
            alert('Failed to clone coffee.');
        }
    };

    const openCoffeeTypeShopUrl = (typeId, ev) => {
        if (ev) ev.stopPropagation();
        const type = getCoffeeTypes().find((ct) => ct.id === typeId);
        const url = type?.webshopUrl || type?.shopUrl;
        if (!url) return;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const openNewBagForCoffeeType = async () => {
        const user = getCurrentUser();
        const typeId = getCurrentCoffeeTypeId();
        if (!user || !typeId) return;

        const type = getCoffeeTypes().find((ct) => ct.id === typeId);
        if (!type) return;

        const nowIso = new Date().toISOString();
        const newBeanData = {
            coffeeTypeId: type.id,
            roaster: type.roaster || '',
            farmer: type.farmer || '',
            origin: type.origin || '',
            processing: type.processing || '',
            variety: type.variety || '',
            roastType: type.roast || type.roastType || '',
            shopUrl: type.webshopUrl || type.shopUrl || '',
            archived: false,
            frozen: false,
            price: null,
            stock: 250,
            beansLeft: 250,
            openedDate: null,
            frozenDate: null,
            archivedDate: null,
            roastDate: null,
            createdAt: nowIso,
            updatedAt: nowIso
        };

        try {
            const newBeanRef = await repo.createBean({ uid: user.uid, data: newBeanData });
            const newBean = { id: newBeanRef.id, ...newBeanData };
            setBeansState([...getBeans(), newBean]);
            await dispatchOnly('pin.autoPinOpenBagsIfEnabled', {});
            dispatchOnly('beans.openCardForEdit', { beanId: newBeanRef.id, event: null });
            closeCoffeeTypeCard(null);
            publishEvent('coffees.beanOpened', { beanId: newBeanRef.id, coffeeTypeId: typeId });
        } catch (err) {
            console.error('Error creating bean from coffee type:', err);
            alert('Failed to create bag.');
        }
    };

    const showBeansForCoffeeType = () => {
        const typeId = getCurrentCoffeeTypeId();
        if (!typeId) return;
        closeCoffeeTypeCard(null);
        closeCoffeeTypes();
        dispatchOnly(
            'beans.showForCoffeeType',
            { coffeeTypeId: typeId, source: 'coffees' }
        );
        publishEvent('coffees.beansRequested', { coffeeTypeId: typeId });
    };

    const showBeansForCoffeeTypeFromTable = (typeId) => {
        if (!typeId) return;
        coffeeTypeCard.closeCoffeeTypeCardMenu();
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        closeCoffeeTypeCard(null);
        closeCoffeeTypes();
        dispatchOnly(
            'beans.showForCoffeeType',
            { coffeeTypeId: typeId, source: 'coffees.table' }
        );
        publishEvent('coffees.beansRequested', { coffeeTypeId: typeId });
    };

    const showBrewsForCoffeeType = () => {
        const typeId = getCurrentCoffeeTypeId();
        if (!typeId) return;
        coffeeTypeCard.closeCoffeeTypeCardMenu();
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        closeCoffeeTypeCard(null);
        closeCoffeeTypes();
        dispatchOnly(
            'brews.showForCoffeeType',
            { coffeeTypeId: typeId, source: 'coffees' }
        );
        publishEvent('coffees.brewsRequested', { coffeeTypeId: typeId });
    };

    const showBrewsForCoffeeTypeFromTable = (typeId) => {
        if (!typeId) return;
        coffeeTypeCard.closeCoffeeTypeCardMenu();
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        closeCoffeeTypeCard(null);
        closeCoffeeTypes();
        dispatchOnly('brews.showForCoffeeType', { coffeeTypeId: typeId, source: 'coffees.table' });
        publishEvent('coffees.brewsRequested', { coffeeTypeId: typeId });
    };

    const updateCoffeeTypeCardNav = () => {
        const order = getFilteredSortedCoffeeTypes().map((type) => type.id);
        const idx = order.indexOf(getCurrentCoffeeTypeId());
        const prevBtn = document.getElementById('coffeeTypeCardPrevBtn');
        const nextBtn = document.getElementById('coffeeTypeCardNextBtn');
        if (!prevBtn || !nextBtn) return;
        prevBtn.disabled = idx <= 0;
        nextBtn.disabled = idx === -1 || idx >= order.length - 1;
        prevBtn.classList.toggle('opacity-40', prevBtn.disabled);
        prevBtn.classList.toggle('cursor-not-allowed', prevBtn.disabled);
        nextBtn.classList.toggle('opacity-40', nextBtn.disabled);
        nextBtn.classList.toggle('cursor-not-allowed', nextBtn.disabled);
    };

    const navigateCoffeeTypeCard = (direction) => {
        const order = getFilteredSortedCoffeeTypes().map((type) => type.id);
        const idx = order.indexOf(getCurrentCoffeeTypeId());
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= order.length) return;
        openCoffeeTypeCard(order[nextIdx]);
    };

    const coffeeTypeCard = createCoffeeTypeCardModule({
        dataService,
        storageService,
        imageCompression,
        removeCoffeeImageBackground,
        getCurrentUser,
        getCurrentView,
        getCurrentCoffeeTypeId,
        setCurrentCoffeeTypeId,
        getCoffeeTypes,
        setCoffeeTypesState,
        getBeans,
        setBeansState,
        openAppConfirm,
        getStarDisplay,
        renderCoffeeTypesTable: () => renderCoffeeTypesTable(),
        updateCoffeeTypeSelectors,
        renderPinnedTiles,
        dispatchCommand,
        openCoffeeTypeShopUrl,
        openNewBagForCoffeeType,
        updateCoffeeTypeCardNav,
        openLightbox,
        publishEvent
    });
    openCoffeeTypeCard = coffeeTypeCard.openCoffeeTypeCard;
    closeCoffeeTypeCard = coffeeTypeCard.closeCoffeeTypeCard;
    const enterCoffeeTypeEditMode = coffeeTypeCard.enterCoffeeTypeEditMode;

    const coffeeTypesTable = createCoffeeTypesTableModule({
        getCoffeeTypes: () => withoutDrafts(getCoffeeTypes()),
        getBeans,
        getCoffees,
        getPinnedBrewsPreferences,
        getCurrentView,
        getCoffeeTypesSearch,
        setCoffeeTypesSearchState,
        getCoffeeTypesFilters,
        setCoffeeTypesFiltersState,
        getCoffeeTypesSortKey,
        setCoffeeTypesSortKeyState,
        getCoffeeTypesSortDir,
        setCoffeeTypesSortDirState,
        getStarDisplay,
        dispatchCommand
    });
    getFilteredSortedCoffeeTypes = coffeeTypesTable.getFilteredSortedCoffeeTypes;
    renderCoffeeTypesTable = coffeeTypesTable.renderCoffeeTypesTable;
    return {
        openCoffeeTypes,
        closeCoffeeTypes,
        createCoffeeTypeFromModal,
        cloneCoffeeTypeToMine,
        openCoffeeTypeShopUrl,
        openNewBagForCoffeeType,
        showBeansForCoffeeType,
        showBrewsForCoffeeType,
        updateCoffeeTypeCardNav,
        navigateCoffeeTypeCard,
        showBeansForCoffeeTypeFromTable,
        showBrewsForCoffeeTypeFromTable,
        openNewBagForCoffeeTypeFromTable: coffeeTypeCard.openNewBagForCoffeeTypeFromTable,
        openCoffeeTypeFromTableEdit: coffeeTypeCard.openCoffeeTypeFromTableEdit,
        deleteCoffeeTypeFromTable: coffeeTypeCard.deleteCoffeeTypeFromTable,
        deleteCoffeeType: coffeeTypeCard.deleteCoffeeType,
        triggerCoffeeTypePhoto: coffeeTypeCard.triggerCoffeeTypePhoto,
        openCoffeeTypePhoto: coffeeTypeCard.openCoffeeTypePhoto,
        removeCoffeeTypePhoto: coffeeTypeCard.removeCoffeeTypePhoto,
        replaceCoffeeTypePhotoWithBackgroundRemoved: coffeeTypeCard.replaceCoffeeTypePhotoWithBackgroundRemoved,
        handleCoffeeTypePhoto: coffeeTypeCard.handleCoffeeTypePhoto,
        openCoffeeTypeCard: coffeeTypeCard.openCoffeeTypeCard,
        closeCoffeeTypeCard: coffeeTypeCard.closeCoffeeTypeCard,
        enterCoffeeTypeEditMode: coffeeTypeCard.enterCoffeeTypeEditMode,
        cancelCoffeeTypeEditMode: coffeeTypeCard.cancelCoffeeTypeEditMode,
        saveCoffeeTypeEdits: coffeeTypeCard.saveCoffeeTypeEdits,
        closeCoffeeTypeCardMenu: coffeeTypeCard.closeCoffeeTypeCardMenu,
        setCoffeeTypesSearch: coffeeTypesTable.setCoffeeTypesSearch,
        clearCoffeeTypesSearch: coffeeTypesTable.clearCoffeeTypesSearch,
        toggleCoffeeTypesQuickFilter: coffeeTypesTable.toggleCoffeeTypesQuickFilter,
        openCoffeeTypesQuickFilterValues: coffeeTypesTable.openCoffeeTypesQuickFilterValues,
        applyCoffeeTypesFilterFromQuick: coffeeTypesTable.applyCoffeeTypesFilterFromQuick,
        clearCoffeeTypesFilters: coffeeTypesTable.clearCoffeeTypesFilters,
        renderCoffeeTypesActiveFilters: coffeeTypesTable.renderCoffeeTypesActiveFilters,
        setCoffeeTypesSort: coffeeTypesTable.setCoffeeTypesSort,
        updateCoffeeTypesSortIcons: coffeeTypesTable.updateCoffeeTypesSortIcons,
        getFilteredSortedCoffeeTypes: coffeeTypesTable.getFilteredSortedCoffeeTypes,
        renderCoffeeTypesTable: coffeeTypesTable.renderCoffeeTypesTable
    };
};
