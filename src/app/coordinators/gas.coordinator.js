import { createGasTableModule } from '../../features/gas/gas-table.js';
import { createGasCardModule } from '../../features/gas/gas-card.js';
import { createDraftId, withoutDrafts } from '../../core/draft-items.js';

export const createGasCoordinator = ({
    dataService,
    storageService,
    imageCompression,
    appCommands,
    appEvents,
    getCurrentUser,
    getCurrentView,
    getPinnedBrewsPreferences,
    getCurrentGasId,
    setCurrentGasId,
    getGasItems,
    setGasItemsState,
    getGasSearch,
    setGasSearchState,
    getGasFilters,
    setGasFiltersState,
    getGasSortKey,
    setGasSortKeyState,
    getGasSortDir,
    setGasSortDirState,
    getCoffees,
    setCoffeesState,
    openAppConfirm,
    getRefreshBrewGearSelectors,
    openLightbox,
    onGasUiOpened
}) => {
    if (!appCommands?.dispatch) {
        throw new Error('createGasCoordinator requires appCommands.dispatch');
    }
    if (!appEvents?.publish) {
        throw new Error('createGasCoordinator requires appEvents.publish');
    }
    const dispatchCommand = (commandName, payload) => {
        return appCommands.dispatch(commandName, payload, { source: 'gas.coordinator' });
    };
    const publishEvent = (eventName, payload) => {
        appEvents.publish(eventName, payload, { source: 'gas.coordinator' });
    };
    const { db: resolvedDb, addDoc: resolvedAddDoc, collection: resolvedCollection } = dataService || {};
    if (!resolvedDb || !resolvedAddDoc || !resolvedCollection) {
        throw new Error('createGasCoordinator requires dataService { db, addDoc, collection }');
    }
    let openGasCard = () => {};
    let enterGasEditMode = () => {};
    let renderGasTable = () => {};
    let getFilteredSortedGasItems = () => [];
    let closeGasCard = () => {};
    let closeGasList = () => {};
    const notifyGasUiOpened = () => {
        if (typeof onGasUiOpened !== 'function') return;
        onGasUiOpened();
    };

    const createGasItemFromModal = async () => {
        const user = getCurrentUser();
        if (!user) return alert('Please sign in.');
        if (!resolvedDb || !resolvedAddDoc || !resolvedCollection) return alert('Data service unavailable.');
        const nowIso = new Date().toISOString();
        const gasData = {
            uid: user.uid,
            name: '',
            price: null,
            type: 'Other',
            methods: [],
            imageUrl: '',
            purchasedDate: nowIso,
            archived: false,
            createdAt: nowIso,
            updatedAt: nowIso
        };

        // A draft: it is written only when the card's Save is clicked (saveGasEdits).
        const newGas = { id: createDraftId(), ...gasData, isDraft: true };
        setGasItemsState([...withoutDrafts(getGasItems()), newGas]);
        notifyGasUiOpened();
        await dispatchCommand('gas.openCardForEdit', { id: newGas.id });
    };

    const gasTable = createGasTableModule({
        getGasItems: () => withoutDrafts(getGasItems()),
        getCoffees,
        getPinnedBrewsPreferences,
        getCurrentView,
        getGasSearch,
        setGasSearchState,
        getGasFilters,
        setGasFiltersState,
        getGasSortKey,
        setGasSortKeyState,
        getGasSortDir,
        setGasSortDirState,
        dispatchCommand
    });
    renderGasTable = gasTable.renderGasTable;
    getFilteredSortedGasItems = gasTable.getFilteredSortedGasItems;
    closeGasList = gasTable.closeGasList;

    const gasCard = createGasCardModule({
        dataService,
        storageService,
        getCurrentUser,
        getCurrentView,
        getCurrentGasId,
        setCurrentGasId,
        getGasItems,
        setGasItemsState,
        getCoffees,
        setCoffeesState,
        getFilteredSortedGasItems: gasTable.getFilteredSortedGasItems,
        imageCompression,
        openAppConfirm,
        renderGasTable: gasTable.renderGasTable,
        openLightbox,
        onGasCreated: (gasId) => {
            getRefreshBrewGearSelectors()?.();
            publishEvent('gas.created', { gasId });
        }
    });
    openGasCard = gasCard.openGasCard;
    enterGasEditMode = gasCard.enterGasEditMode;
    closeGasCard = gasCard.closeGasCard;

    const openGasList = (...args) => {
        notifyGasUiOpened();
        return gasTable.openGasList(...args);
    };
    const openGasCardWithListener = (...args) => {
        notifyGasUiOpened();
        return gasCard.openGasCard(...args);
    };

    const showBrewsForGear = (gearId = null) => {
        const targetId = gearId || getCurrentGasId();
        if (!targetId) return;
        gasCard.closeGasCardMenu();
        closeGasCard(null);
        closeGasList();
        dispatchCommand('brews.showForGear', { gearId: targetId });
        publishEvent('gas.brewsRequested', { gearId: targetId });
    };

    return {
        createGasItemFromModal,
        openGasList,
        closeGasList: gasTable.closeGasList,
        setGasSearch: gasTable.setGasSearch,
        clearGasSearch: gasTable.clearGasSearch,
        toggleGasQuickFilter: gasTable.toggleGasQuickFilter,
        openGasQuickFilterValues: gasTable.openGasQuickFilterValues,
        applyGasFilterFromQuick: gasTable.applyGasFilterFromQuick,
        clearGasFilters: gasTable.clearGasFilters,
        renderGasActiveFilters: gasTable.renderGasActiveFilters,
        setGasSort: gasTable.setGasSort,
        updateGasSortIcons: gasTable.updateGasSortIcons,
        getFilteredSortedGasItems: gasTable.getFilteredSortedGasItems,
        renderGasTable: gasTable.renderGasTable,
        updateGasCardNav: gasCard.updateGasCardNav,
        openGasCard: openGasCardWithListener,
        closeGasCard: gasCard.closeGasCard,
        enterGasEditMode: gasCard.enterGasEditMode,
        cancelGasEditMode: gasCard.cancelGasEditMode,
        saveGasEdits: gasCard.saveGasEdits,
        toggleGasArchive: gasCard.toggleGasArchive,
        deleteGasItem: gasCard.deleteGasItem,
        navigateGasCard: gasCard.navigateGasCard,
        openGasFromTableEdit: (...args) => {
            notifyGasUiOpened();
            return gasCard.openGasFromTableEdit(...args);
        },
        openGasMergeFromTable: (...args) => {
            notifyGasUiOpened();
            return gasCard.openGasMergeFromTable(...args);
        },
        toggleGasArchiveFromTable: gasCard.toggleGasArchiveFromTable,
        deleteGasFromTable: gasCard.deleteGasFromTable,
        triggerGasPhoto: gasCard.triggerGasPhoto,
        openGasPhoto: gasCard.openGasPhoto,
        removeGasPhoto: gasCard.removeGasPhoto,
        handleGasPhoto: gasCard.handleGasPhoto,
        closeGasCardMenu: gasCard.closeGasCardMenu,
        openGasMergeModal: gasCard.openGasMergeModal,
        closeGasMergeModal: gasCard.closeGasMergeModal,
        mergeGasItem: gasCard.mergeGasItem,
        openGasBulkAddModal: gasCard.openGasBulkAddModal,
        closeGasBulkAddModal: gasCard.closeGasBulkAddModal,
        openGasBulkAddFromTable: (...args) => {
            notifyGasUiOpened();
            return gasCard.openGasBulkAddFromTable(...args);
        },
        bulkAddGearToBrews: gasCard.bulkAddGearToBrews,
        showBrewsForGear
    };
};
