import { withDetectedDecaf } from '../../core/coffee-decaf.js';
import { openAppPrompt } from '../../core/confirm.js';
import { fetchPageImage } from '../../core/page-image.js';
import { withoutDrafts } from '../../core/draft-items.js';
import { AiNotConfiguredError, analyzeCoffeeBag, analyzeCoffeeBagUrl } from '../../core/gemini-client.js';

export const createAiImportModule = ({
    aiSettings,
    imageCompression,
    getCurrentUser,
    toggleForm,
    dataService,
    storageService,
    dispatchCommand,
    getCoffeeTypes,
    setCoffeeTypes,
    removeCoffeeImageBackground,
    openCoffeeTypeCard,
    enterCoffeeTypeEditMode,
    functionsService = null,
    cancelBeanEditMode = () => {},
    cancelCoffeeTypeEditMode = () => {}
}) => {
    const { db, doc, setDoc, updateDoc, collection, writeBatch } = dataService || {};
    const { storage, ref, uploadBytes, getDownloadURL } = storageService || {};
    if (!db || !doc || !setDoc || !updateDoc || !collection || !writeBatch) {
        throw new Error('createAiImportModule requires dataService { db, doc, setDoc, updateDoc, collection, writeBatch }');
    }
    if (!storage || !ref || !uploadBytes || !getDownloadURL) {
        throw new Error('createAiImportModule requires storageService { storage, ref, uploadBytes, getDownloadURL }');
    }
    let pendingAIBeanImageFile = null;
    // The page an Extract From URL in the brew form came from; saved as the coffee's web shop URL.
    let pendingAIWebshopUrl = '';
    let pendingAITasteNotes = '';
    const callFetchShopImage = functionsService?.httpsCallable
        ? functionsService.httpsCallable(functionsService.functions, 'fetchShopImage')
        : null;
    const maybeRemoveCoffeeImageBackground = async (file, context = 'unknown') => {
        if (typeof removeCoffeeImageBackground !== 'function') return file;
        return removeCoffeeImageBackground(file, { source: context });
    };

    const callBagAi = async (file) => {
        // Resolve the key first so a missing key fails before the image is compressed.
        const { geminiApiKey, geminiModel } = await aiSettings.load();
        if (!geminiApiKey) throw new AiNotConfiguredError();
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        const base64String = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(compressedFile);
        });

        const data = await analyzeCoffeeBag({
            apiKey: geminiApiKey,
            model: geminiModel,
            base64Image: base64String,
            mimeType: compressedFile.type || 'image/jpeg'
        });
        return { compressedFile, data };
    };

    const triggerAIScan = (mode = null) => {
        if (!getCurrentUser()) return alert('Please sign in to use AI scanning.');
        const input = document.getElementById('aiFileInput');
        if (mode === 'camera') input.setAttribute('capture', 'environment');
        else if (mode === 'library') input.removeAttribute('capture');
        document.getElementById('aiMenuDropdown').classList.add('hidden');
        input.click();
    };

    const toggleAiMenu = (e) => {
        if (e) e.stopPropagation();
        document.getElementById('aiMenuDropdown').classList.toggle('hidden');
    };

    const toggleBeansAiMenu = (e) => {
        if (e) e.stopPropagation();
        document.getElementById('beansAiMenuDropdown').classList.toggle('hidden');
    };

    const toggleCoffeeTypesAiMenu = (e) => {
        if (e) e.stopPropagation();
        document.getElementById('coffeeTypesAiMenuDropdown').classList.toggle('hidden');
    };

    const triggerBeansAIScan = (mode = null) => {
        if (!getCurrentUser()) return alert('Please sign in to use AI scanning.');
        const input = document.getElementById('beansAiFileInput');
        if (mode === 'camera') input.setAttribute('capture', 'environment');
        else if (mode === 'library') input.removeAttribute('capture');
        document.getElementById('beansAiMenuDropdown').classList.add('hidden');
        input.click();
    };

    const triggerCoffeeTypesAIScan = (mode = null) => {
        if (!getCurrentUser()) return alert('Please sign in to use AI scanning.');
        const input = document.getElementById('coffeeTypesAiFileInput');
        if (mode === 'camera') input.setAttribute('capture', 'environment');
        else if (mode === 'library') input.removeAttribute('capture');
        document.getElementById('coffeeTypesAiMenuDropdown').classList.add('hidden');
        input.click();
    };

    // Applies what the AI extracted; getResult returns { data, compressedFile } (no file for a URL).
    const runBrewFormExtract = async (getResult) => {
        const btn = document.getElementById('aiScanBtn');
        const originalContent = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...';
            btn.classList.add('ai-loading-pulse');

            const { compressedFile, data, sourceUrl = '' } = await getResult();
            const fieldsToFill = ['roaster', 'farmer', 'origin', 'variety', 'processing', 'roastType'];
            fieldsToFill.forEach((id) => {
                const el = document.getElementById(id);
                if (data[id] && el) {
                    el.value = data[id];
                    // Keep dependent UI (like collapsed coffee details title) in sync on AI-fill.
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.classList.add('ai-flash-effect');
                    setTimeout(() => el.classList.remove('ai-flash-effect'), 2000);
                }
            });

            pendingAIBeanImageFile = compressedFile || null;
            pendingAIWebshopUrl = sourceUrl || '';
            pendingAITasteNotes = data.tasteNotes || '';
            toggleForm(true);
        } catch (error) {
            console.error(error);
            alert(`Error scanning bag: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            btn.classList.remove('ai-loading-pulse');
        }
    };

    // After the brew form saved and the coffee is known: give it the photo and the web shop
    // URL and taste notes from the last Extract. An existing web shop URL or taste notes are kept.
    const uploadPendingCoffeeTypeImage = async (coffeeTypeId) => {
        const user = getCurrentUser();
        if ((!pendingAIBeanImageFile && !pendingAIWebshopUrl && !pendingAITasteNotes) || !coffeeTypeId || !user) return null;

        const nowIso = new Date().toISOString();
        const updates = {};
        if (pendingAIBeanImageFile) {
            const processedFile = await maybeRemoveCoffeeImageBackground(
                pendingAIBeanImageFile,
                'ai-import.uploadPendingCoffeeTypeImage'
            );
            const storageRef = ref(storage, `photos/${user.uid}/coffee_type_${coffeeTypeId}_${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, processedFile);
            updates.imageUrl = await getDownloadURL(snapshot.ref);
        }
        const currentType = getCoffeeTypes().find((type) => type.id === coffeeTypeId);
        if (pendingAIWebshopUrl && !(currentType?.webshopUrl || currentType?.shopUrl)) {
            updates.webshopUrl = pendingAIWebshopUrl;
        }
        if (pendingAITasteNotes && !`${currentType?.tasteNotes || ''}`.trim()) {
            updates.tasteNotes = pendingAITasteNotes;
        }
        pendingAIBeanImageFile = null;
        pendingAIWebshopUrl = '';
        pendingAITasteNotes = '';
        if (!Object.keys(updates).length) return null;

        updates.updatedAt = nowIso;
        await updateDoc(doc(db, 'users', user.uid, 'coffeeTypes', coffeeTypeId), updates);
        setCoffeeTypes(getCoffeeTypes().map((type) => (type.id === coffeeTypeId ? { ...type, ...updates } : type)));
        return updates.imageUrl || null;
    };

    const clearPendingAIBeanImageFile = () => {
        pendingAIBeanImageFile = null;
        pendingAIWebshopUrl = '';
        pendingAITasteNotes = '';
    };

    // While Extract runs from an Add card, that card stays open with a spinner over it
    // (and the add buttons spin too, in case the card is closed meanwhile).
    const showCardBusy = (busyId) => {
        const el = document.getElementById(busyId);
        if (el) el.hidden = false;
        const buttons = showAiScanBusy();
        return {
            done: () => {
                if (el) el.hidden = true;
                buttons.done();
            }
        };
    };
    // True when the Add card (an unsaved draft) is still open, so it can be replaced.
    const isAddCardOpen = (overlayId) => {
        const overlay = document.getElementById(overlayId);
        return !!overlay && !overlay.classList.contains('hidden') && overlay.hasAttribute('data-adding');
    };

    // Spinner on the add buttons (header on desktop, floating on mobile) while a photo is scanned.
    const showAiScanBusy = () => {
        const buttons = ['menuAddBrewBtn', 'fabAddBrewBtn']
            .map((id) => document.getElementById(id))
            .filter(Boolean);
        const saved = buttons.map((btn) => ({ btn, html: btn.innerHTML, title: btn.title }));
        saved.forEach(({ btn }) => {
            btn.disabled = true;
            btn.title = 'Scanning...';
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btn.classList.add('ai-loading-pulse');
        });
        return {
            done: () => saved.forEach(({ btn, html, title }) => {
                btn.disabled = false;
                btn.title = title;
                btn.innerHTML = html;
                btn.classList.remove('ai-loading-pulse');
            })
        };
    };

    // Applies what the AI extracted; getResult returns { data, compressedFile } (no file for a URL).
    const runBagExtract = async (getResult) => {

        const user = getCurrentUser();
        if (!user) return;

        // The add card closes when Extract is chosen, so the page's add buttons show the progress.
        const busy = showCardBusy('beanCardBusy');

        try {

            const { compressedFile, data, sourceUrl = '' } = await getResult();
            const uploadFile = compressedFile
                ? await maybeRemoveCoffeeImageBackground(compressedFile, 'ai-import.handleBeansAIFile')
                : null;
            const nowIso = new Date().toISOString();
            const beanRef = doc(collection(db, 'users', user.uid, 'beans'));
            const typeRef = doc(collection(db, 'users', user.uid, 'coffeeTypes'));
            let imageURL = '';
            if (uploadFile) {
                const storageRef = ref(storage, `photos/${user.uid}/coffee_type_${typeRef.id}_${Date.now()}`);
                const snapshot = await uploadBytes(storageRef, uploadFile);
                imageURL = await getDownloadURL(snapshot.ref);
            }

            const typeData = withDetectedDecaf({
                uid: user.uid,
                roaster: data.roaster || '',
                farmer: data.farmer || '',
                origin: data.origin || '',
                processing: data.processing || '',
                variety: data.variety || '',
                roast: data.roastType || data.roast || '',
                rating: 0,
                tasteNotes: data.tasteNotes || '',
                webshopUrl: sourceUrl || '',
                imageUrl: imageURL,
                createdAt: nowIso,
                updatedAt: nowIso
            });

            const beanData = {
                coffeeTypeId: typeRef.id,
                createdAt: nowIso,
                updatedAt: nowIso,
                archived: false,
                frozen: false,
                stock: 250,
                beansLeft: 250,
                openedDate: null,
                archivedDate: null
            };

            const batch = writeBatch(db);
            batch.set(typeRef, typeData);
            batch.set(beanRef, beanData);
            await batch.commit();
            await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});

            const current = getCoffeeTypes();
            if (!current.find((ct) => ct.id === typeRef.id)) {
                setCoffeeTypes([...current, { id: typeRef.id, ...typeData }]);
            }
            // Replace the Add bag card (an unsaved draft) by the new bag, ready to check and edit.
            busy.done();
            if (isAddCardOpen('beanCardOverlay')) cancelBeanEditMode();
            await dispatchCommand?.('beans.openCardForEdit', { beanId: beanRef.id, event: null });
        } catch (error) {
            console.error(error);
            alert(`Error scanning bag: ${error.message}`);
        } finally {
            busy.done();
        }
    };

    // Applies what the AI extracted; getResult returns { data, compressedFile } (no file for a URL).
    const runCoffeeExtract = async (getResult) => {

        const user = getCurrentUser();
        if (!user) return;

        // The add card closes when Extract is chosen, so the page's add buttons show the progress.
        const busy = showCardBusy('coffeeTypeCardBusy');

        try {

            const { compressedFile, data, sourceUrl = '' } = await getResult();
            const uploadFile = compressedFile
                ? await maybeRemoveCoffeeImageBackground(compressedFile, 'ai-import.handleCoffeeTypesAIFile')
                : null;
            const nowIso = new Date().toISOString();
            const typeRef = doc(collection(db, 'users', user.uid, 'coffeeTypes'));
            let imageURL = '';
            if (uploadFile) {
                const storageRef = ref(storage, `photos/${user.uid}/coffee_type_${typeRef.id}_${Date.now()}`);
                const snapshot = await uploadBytes(storageRef, uploadFile);
                imageURL = await getDownloadURL(snapshot.ref);
            }

            const typeData = withDetectedDecaf({
                uid: user.uid,
                roaster: data.roaster || '',
                farmer: data.farmer || '',
                origin: data.origin || '',
                processing: data.processing || '',
                variety: data.variety || '',
                roast: data.roastType || data.roast || '',
                rating: 0,
                tasteNotes: data.tasteNotes || '',
                webshopUrl: sourceUrl || '',
                imageUrl: imageURL,
                createdAt: nowIso,
                updatedAt: nowIso
            });

            await setDoc(typeRef, typeData);
            const newType = { id: typeRef.id, ...typeData };
            // Replace the Add coffee card (an unsaved draft) by the new coffee, ready to check and edit.
            busy.done();
            if (isAddCardOpen('coffeeTypeCardOverlay')) cancelCoffeeTypeEditMode();
            const current = withoutDrafts(getCoffeeTypes());
            setCoffeeTypes(current.find((ct) => ct.id === newType.id) ? current : [...current, newType]);
            openCoffeeTypeCard(newType.id);
            enterCoffeeTypeEditMode();
        } catch (error) {
            console.error(error);
            alert(`Error reading this coffee: ${error.message}`);
        } finally {
            busy.done();
        }
    };

    const fromFile = (runner) => async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            await runner(() => callBagAi(file));
        } finally {
            event.target.value = '';
        }
    };
    const handleAIFile = fromFile(runBrewFormExtract);
    const handleBeansAIFile = fromFile(runBagExtract);
    const handleCoffeeTypesAIFile = fromFile(runCoffeeExtract);

    // Extract from a web page: ask for the URL, let Gemini read the page.
    const askForUrl = async () => {
        const url = await openAppPrompt({
            title: 'Extract from a web page',
            message: 'Paste the address of a page about this coffee, for example the roaster\'s shop page. AI reads the page and fills in the details.',
            placeholder: 'https://',
            inputType: 'url',
            confirmLabel: 'Extract'
        });
        if (!url) return '';
        return /^https?:\/\//i.test(url) ? url : `https://${url}`;
    };
    const fromUrl = (runner, menuId) => async () => {
        if (!getCurrentUser()) return alert('Please sign in to use AI extraction.');
        document.getElementById(menuId)?.classList.add('hidden');
        const url = await askForUrl();
        if (!url) return;
        await runner(async () => {
            const { geminiApiKey, geminiModel } = await aiSettings.load();
            if (!geminiApiKey) throw new AiNotConfiguredError();
            // Details from Gemini and the page's photo at the same time; the photo is optional.
            // The photo address Gemini read on the page is a fallback for shops that block the page.
            const details = analyzeCoffeeBagUrl({ apiKey: geminiApiKey, model: geminiModel, url });
            const [data, photo] = await Promise.all([
                details,
                fetchPageImage(url, {
                    callFetchShopImage,
                    imageUrlHint: details.then((result) => result.imageUrl).catch(() => '')
                })
            ]);
            return { data, compressedFile: await compressPagePhoto(photo), sourceUrl: url };
        });
    };
    // Same size limits as a scanned photo; if compressing fails, the photo is used as it is.
    const compressPagePhoto = async (blob) => {
        if (!blob) return null;
        const extension = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const file = new File([blob], `shop-photo.${extension}`, { type: blob.type });
        try {
            return await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true });
        } catch (error) {
            console.warn('[Extract] Could not compress the shop photo', error);
            return file;
        }
    };
    const triggerAIUrl = fromUrl(runBrewFormExtract, 'aiMenuDropdown');
    const triggerBeansAIUrl = fromUrl(runBagExtract, 'beansAiMenuDropdown');
    const triggerCoffeeTypesAIUrl = fromUrl(runCoffeeExtract, 'coffeeTypesAiMenuDropdown');

    return {
        triggerAIScan,
        triggerAIUrl,
        triggerBeansAIUrl,
        triggerCoffeeTypesAIUrl,
        toggleAiMenu,
        toggleBeansAiMenu,
        toggleCoffeeTypesAiMenu,
        triggerBeansAIScan,
        triggerCoffeeTypesAIScan,
        handleAIFile,
        uploadPendingCoffeeTypeImage,
        clearPendingAIBeanImageFile,
        handleBeansAIFile,
        handleCoffeeTypesAIFile
    };
};
