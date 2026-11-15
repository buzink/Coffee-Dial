import { encodeBrewGraphDoc, splitBrewGraph } from '../../core/brew-graphs.js';
import { BREW_DUPLICATE_FIELDS, getBrewGrinderName, isGrinderGear, withoutFields } from '../../core/brew-fields.js';

const cleanText = (value) => {
    const text = (value ?? '').toString().trim();
    return text && text !== '-' ? text : '';
};
const keyOf = (value) => cleanText(value).toLowerCase();

export const createImportExportModule = ({
    loadBrewsWithGraphs = null,
    getCurrentUser,
    getPendingImportBrews,
    setPendingImportBrews,
    parseBeanconquerorCSV,
    mapBeanconquerorBrews,
    dataService,
    getFilteredCoffees,
    getBeans,
    getCoffeeTypes,
    getGasItems,
    getCoffeeTypeDisplay,
    getCoffeeTypeForBrew,
    openAppConfirm
}) => {
    const { db, collection, doc, writeBatch } = dataService || {};
    if (!db || !collection || !doc || !writeBatch) {
        throw new Error('createImportExportModule requires dataService { db, collection, doc, writeBatch }');
    }
    const setImportExportMode = (mode = 'export') => {
        const isImport = mode === 'import';
        const exportPanel = document.getElementById('importExportExportPanel');
        const importPanel = document.getElementById('importExportImportPanel');
        const exportTab = document.getElementById('importExportTabExport');
        const importTab = document.getElementById('importExportTabImport');

        if (exportPanel) exportPanel.classList.toggle('hidden', isImport);
        if (importPanel) importPanel.classList.toggle('hidden', !isImport);

        if (exportTab) {
            exportTab.classList.toggle('bg-white', !isImport);
            exportTab.classList.toggle('dark:bg-[#292524]', !isImport);
            exportTab.classList.toggle('text-coffee-800', !isImport);
            exportTab.classList.toggle('dark:text-white', !isImport);
            exportTab.classList.toggle('shadow-sm', !isImport);
            exportTab.classList.toggle('text-coffee-500', isImport);
            exportTab.classList.toggle('dark:text-[#a8a29e]', isImport);
        }

        if (importTab) {
            importTab.classList.toggle('bg-white', isImport);
            importTab.classList.toggle('dark:bg-[#292524]', isImport);
            importTab.classList.toggle('text-coffee-800', isImport);
            importTab.classList.toggle('dark:text-white', isImport);
            importTab.classList.toggle('shadow-sm', isImport);
            importTab.classList.toggle('text-coffee-500', !isImport);
            importTab.classList.toggle('dark:text-[#a8a29e]', !isImport);
        }
    };

    const resetImportState = () => {
        setPendingImportBrews([]);
        const summaryEl = document.getElementById('importSummary');
        if (summaryEl) summaryEl.textContent = 'Select a CSV file to preview the import.';
        const confirmBtn = document.getElementById('importConfirmBtn');
        if (confirmBtn) confirmBtn.disabled = true;
        const input = document.getElementById('importFileInput');
        if (input) input.value = '';
        const previewEl = document.getElementById('importPreview');
        if (previewEl) previewEl.classList.add('hidden');
        const previewBody = document.getElementById('importPreviewBody');
        if (previewBody) previewBody.innerHTML = '';
    };

    const renderImportPreview = (brews) => {
        const previewEl = document.getElementById('importPreview');
        const previewBody = document.getElementById('importPreviewBody');
        if (!previewEl || !previewBody) return;

        if (!brews.length) {
            previewEl.classList.add('hidden');
            previewBody.innerHTML = '';
            return;
        }

        const rows = brews.slice(0, 10);
        previewBody.innerHTML = rows.map((brew) => {
            const date = brew.createdAt ? new Date(brew.createdAt).toLocaleString() : '';
            const grind = brew.grind ?? '';
            const weight = brew.weight ?? '';
            const ratio = brew.ratio ?? '';
            const time = brew.time ?? '';
            const temp = brew.temp ?? '';
            const rating = brew.rating ?? '';
            return `
                <tr class="border-t border-coffee-100 dark:border-[#44403c]">
                    <td class="px-2 py-2 whitespace-nowrap">${date}</td>
                    <td class="px-2 py-2">${brew.method || ''}</td>
                    <td class="px-2 py-2">${brew.coffeeType?.farmer || brew.farmer || ''}</td>
                    <td class="px-2 py-2">${brew.grinder || ''}</td>
                    <td class="px-2 py-2 text-right">${grind}</td>
                    <td class="px-2 py-2 text-right">${weight}</td>
                    <td class="px-2 py-2 text-right">${ratio}</td>
                    <td class="px-2 py-2 text-right">${time}</td>
                    <td class="px-2 py-2 text-right">${temp}</td>
                    <td class="px-2 py-2">${brew.drink || ''}</td>
                    <td class="px-2 py-2 text-right">${rating}</td>
                </tr>
            `;
        }).join('');

        previewEl.classList.remove('hidden');
    };

    const openImportExportModal = (mode = 'export') => {
        if (!getCurrentUser()) return alert('Please sign in.');
        if (mode === 'import') resetImportState();
        if (mode === 'export') {
            const brews = getFilteredCoffees();
            const countEl = document.getElementById('exportBrewCount');
            if (countEl) countEl.textContent = brews.length;
        }
        setImportExportMode(mode);
        document.getElementById('importExportModal')?.classList.remove('hidden');
    };

    const closeImportExportModal = () => {
        document.getElementById('importExportModal')?.classList.add('hidden');
    };

    const openImportModal = () => {
        openImportExportModal('import');
    };

    const closeImportModal = () => {
        closeImportExportModal();
    };

    const handleImportFileChange = async (event) => {
        const file = event.target.files[0];
        const summaryEl = document.getElementById('importSummary');
        const confirmBtn = document.getElementById('importConfirmBtn');

        if (!file) {
            resetImportState();
            return;
        }

        try {
            const text = await file.text();
            const { records } = parseBeanconquerorCSV(text);
            const brews = mapBeanconquerorBrews(records, { nowIso: new Date().toISOString() });
            setPendingImportBrews(brews);

            if (summaryEl) {
                summaryEl.textContent = brews.length
                    ? `${brews.length} brews ready to import from ${file.name}.`
                    : 'No importable brews found in this file.';
            }
            renderImportPreview(brews);
            if (confirmBtn) confirmBtn.disabled = brews.length === 0;
        } catch (err) {
            console.error('CSV import failed', err);
            setPendingImportBrews([]);
            if (summaryEl) summaryEl.textContent = 'Failed to read CSV file.';
            renderImportPreview([]);
            if (confirmBtn) confirmBtn.disabled = true;
        }
    };

    // Imported brews (Beanconqueror CSV or our JSON export) carry their coffee and grinder as
    // text. Those become (or match) a coffee with one finished bag per coffee, and a grinder
    // in gear; the brew keeps only the links.
    const prepareImportedBrews = (pendingBrews, uid) => {
        const coffeeTypes = [...(getCoffeeTypes?.() || [])];
        const beans = [...(getBeans?.() || [])];
        const gasItems = [...(getGasItems?.() || [])];
        const newDocs = [];
        const nowIso = new Date().toISOString();
        const newId = (name) => doc(collection(db, 'users', uid, name)).id;
        const coffeeKey = (c) => [c.roaster, c.name, c.farmer, c.origin, c.processing, c.roast].map(keyOf).join('|');
        const bagForCoffee = new Map();

        const findOrCreateCoffee = (fields) => {
            const key = coffeeKey(fields);
            if (!key.replace(/\|/g, '')) return null;
            const existing = coffeeTypes.find((t) => coffeeKey({ ...t, roast: t.roast || t.roastType }) === key);
            if (existing) return existing.id;
            const id = newId('coffeeTypes');
            const data = { uid, ...fields, rating: 0, tasteNotes: '', webshopUrl: '', imageUrl: '', createdAt: nowIso, updatedAt: nowIso };
            coffeeTypes.push({ id, ...data });
            newDocs.push({ path: ['users', uid, 'coffeeTypes', id], data });
            return id;
        };
        const findOrCreateBag = (coffeeTypeId, openedDate) => {
            if (bagForCoffee.has(coffeeTypeId)) return bagForCoffee.get(coffeeTypeId);
            const existing = beans.find((b) => b.coffeeTypeId === coffeeTypeId);
            if (existing) {
                bagForCoffee.set(coffeeTypeId, existing.id);
                return existing.id;
            }
            const id = newId('beans');
            const data = {
                coffeeTypeId, archived: true, frozen: false, stock: null, beansLeft: null, price: null,
                openedDate: openedDate || nowIso, archivedDate: nowIso, frozenDate: null, roastDate: null,
                shopUrl: '', createdAt: nowIso, updatedAt: nowIso
            };
            beans.push({ id, ...data });
            newDocs.push({ path: ['users', uid, 'beans', id], data });
            bagForCoffee.set(coffeeTypeId, id);
            return id;
        };
        const findOrCreateGrinder = (name) => {
            const target = keyOf(name);
            if (!target) return null;
            const existing = gasItems.find((g) => isGrinderGear(g) && keyOf(g.name) === target);
            if (existing) return existing.id;
            const id = newId('gear');
            const data = { name: cleanText(name), price: null, type: 'grinder', methods: [], imageUrl: '', purchasedDate: nowIso, archived: false, createdAt: nowIso, updatedAt: nowIso };
            gasItems.push({ id, ...data });
            newDocs.push({ path: ['users', uid, 'gear', id], data });
            return id;
        };

        const brews = pendingBrews.map((raw) => {
            const src = raw?.coffeeType || raw || {};
            const fields = {
                roaster: cleanText(src.roaster ?? raw.roaster),
                name: cleanText(src.name ?? raw.coffeeName),
                farmer: cleanText(src.farmer ?? raw.farmer),
                origin: cleanText(src.origin ?? raw.origin),
                variety: cleanText(src.variety ?? raw.variety),
                processing: cleanText(src.processing ?? raw.processing),
                roast: cleanText(src.roastType ?? src.roast ?? raw.roastType)
            };
            const brew = withoutFields(raw, [...BREW_DUPLICATE_FIELDS, 'coffeeType', 'coffeeName']);
            const linkedBag = raw.beanId && beans.find((b) => b.id === raw.beanId);
            if (!linkedBag) {
                delete brew.beanId;
                const coffeeTypeId = findOrCreateCoffee(fields);
                if (coffeeTypeId) brew.beanId = findOrCreateBag(coffeeTypeId, raw.createdAt);
            }
            const ids = Array.isArray(raw.gearIds) ? raw.gearIds.filter((id) => gasItems.some((g) => g.id === id)) : [];
            const grinderId = ids.some((id) => isGrinderGear(gasItems.find((g) => g.id === id))) ? null : findOrCreateGrinder(raw.grinder);
            brew.gearIds = grinderId ? [...new Set([...ids, grinderId])] : ids;
            return brew;
        });
        return { brews, newDocs };
    };

    const performImport = async () => {
        const user = getCurrentUser();
        if (!user) return alert('Please sign in.');
        if (!getPendingImportBrews().length) return alert('No brews to import.');

        const shouldImport = await openAppConfirm({
            title: 'Import brews?',
            message: `Import ${getPendingImportBrews().length} brews?`,
            confirmLabel: 'Import',
            cancelLabel: 'Cancel',
            danger: false
        });
        if (!shouldImport) return;

        const confirmBtn = document.getElementById('importConfirmBtn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing...';
        }

        try {
            const col = collection(db, 'users', user.uid, 'coffees');
            const { brews: preparedBrews, newDocs } = prepareImportedBrews(getPendingImportBrews(), user.uid);
            // Brews from a JSON export can carry scale captures. Those go into the brew's graph
            // document, like everywhere else. A batch is limited in size as well as in number of
            // writes, so batches are closed early when captures make them large.
            const MAX_BATCH_WRITES = 400;
            const MAX_BATCH_CHARS = 1500000;
            const pending = preparedBrews;
            let batch = writeBatch(db);
            let batchWrites = 0;
            let batchChars = 0;
            const flush = async () => {
                if (!batchWrites) return;
                await batch.commit();
                batch = writeBatch(db);
                batchWrites = 0;
                batchChars = 0;
            };
            // New coffees, bags and grinders the imported brews link to go in first.
            for (const { path, data } of newDocs) {
                if (batchWrites + 1 > MAX_BATCH_WRITES) await flush();
                batch.set(doc(db, ...path), data);
                batchWrites += 1;
            }
            for (const pendingBrew of pending) {
                const { brew, graph } = splitBrewGraph(pendingBrew);
                const graphChars = graph ? JSON.stringify(graph).length : 0;
                const writes = graph ? 2 : 1;
                if (batchWrites + writes > MAX_BATCH_WRITES || (batchChars && batchChars + graphChars > MAX_BATCH_CHARS)) {
                    await flush();
                }
                const ref = doc(col);
                // An imported flag is only trusted when the captures come with it.
                delete brew.hasGraph;
                batch.set(ref, graph ? { ...brew, hasGraph: true } : brew);
                if (graph) batch.set(doc(db, 'users', user.uid, 'brewGraphs', ref.id), encodeBrewGraphDoc(graph));
                batchWrites += writes;
                batchChars += graphChars;
            }
            await flush();

            resetImportState();
            closeImportExportModal();
            alert('Import complete.');
        } catch (err) {
            console.error('Import failed', err);
            alert('Import failed. Please try again.');
        } finally {
            if (confirmBtn) {
                confirmBtn.disabled = getPendingImportBrews().length === 0;
                confirmBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Import';
            }
        }
    };

    const openExportModal = () => {
        openImportExportModal('export');
    };

    const closeExportModal = () => {
        closeImportExportModal();
    };

    const performExport = async () => {
        const exportType = document.getElementById('exportType').value;
        const format = document.getElementById('exportFormat').value;
        const brews = getFilteredCoffees();

        if (exportType === 'coffees') {
            if (!getBeans().length) return alert('No data to export');
        } else if (!brews.length) return alert('No data to export');

        if (exportType === 'brews') {
            if (format === 'csv') exportBrewsAsCSV(brews);
            else if (format === 'json') await exportAsJSON(brews);
        } else if (exportType === 'brews-beanconqueror') {
            if (format === 'csv') exportBrewsAsBeanconquerorCSV(brews);
            else if (format === 'json') await exportAsJSON(brews);
        } else if (exportType === 'coffees') {
            if (format === 'csv') exportCoffeesAsCSV(getBeans());
            else if (format === 'json') exportCoffeesAsJSON(getBeans());
        }

        closeImportExportModal();
    };

    const exportBrewsAsCSV = (brews) => {
        const esc = (t) => {
            if (t === null || t === undefined) return '';
            const str = String(t);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
            return str;
        };
        const h = ['Date', 'Roaster', 'Origin', 'Blend/Farmer', 'Variety', 'Process', 'Roast', 'Method', 'Grinder', 'Grind', 'In(g)', 'Out(g)', 'Time(s)', 'Temp', 'Drink', 'Rating', 'Notes', 'Improve'];
        const r = brews.map((c) => {
            const type = getCoffeeTypeDisplay(c);
            return [
                c.createdAt || '', esc(type.roaster), esc(type.origin), esc(type.farmer), esc(type.variety), esc(type.processing), esc(type.roastType), esc(c.method), esc(getBrewGrinderName(c, getGasItems?.() || [])), esc(c.grind), esc(c.weight),
                c.weight && c.ratio ? (c.weight * c.ratio).toFixed(1) : '', esc(c.time), esc(c.temp), esc(c.drink), esc(c.rating), esc(c.notes), esc(c.improve)
            ];
        });
        const csvContent = `data:text/csv;charset=utf-8,${h.join(',')}\n${r.map((e) => e.join(',')).join('\n')}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'coffee_log.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportBrewsAsBeanconquerorCSV = (brews) => {
        const headers = ['Grind Setting', 'Ground Coffee (gr)', 'Brew Temperature', 'Preparation method', 'Bean Type', 'Grinder', 'Grind Speed (rpm)', 'Grind Time', 'Profile', 'Preparation tools', 'Temperature Time', 'Time', 'Bloom Time / Pre-infusion', 'First drip time', 'Amount of water', 'Coffee', 'Coffee Concentration', 'Rating', 'Notes', 'Beverage quantity', 'Total dissolved solids %', 'Extraction Yield %', 'Creation Date', 'Brew Ratio', 'Bean Age', 'Archived', 'Bean Id', 'Preparation Id', 'Mill Id'];

        const esc = (t) => {
            if (t === null || t === undefined) return '';
            const str = String(t);
            if (str.includes(';') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
            return str;
        };

        const rows = brews.map((c) => {
            const type = getCoffeeTypeDisplay(c);
            return [
                esc(c.grind || ''), esc(c.weight || ''), esc(c.temp || ''), esc(c.method || ''), esc(type.farmer || ''), esc(getBrewGrinderName(c, getGasItems?.() || [])), '', '', '', '', '', esc(c.time || ''), '', '',
                c.weight && c.ratio ? (c.weight * c.ratio).toFixed(1) : '', '', '', esc(c.rating || ''), esc(c.notes || ''), '', '', '', esc(c.createdAt || ''), esc(c.ratio ? `1 / ${c.ratio.toFixed(2)}` : ''), '', '', '', '', ''
            ];
        });

        const csvContent = `data:text/csv;charset=utf-8,${headers.join(';')}\n${rows.map((e) => e.join(';')).join('\n')}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'coffee_brews_beanconqueror.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportAsJSON = async (sourceBrews) => {
        // A JSON export is a full backup, so it includes the scale captures. Those live in their
        // own document per brew and are fetched here.
        let brews = sourceBrews;
        if (typeof loadBrewsWithGraphs === 'function') {
            const loaded = await loadBrewsWithGraphs(sourceBrews);
            brews = loaded.brews;
            if (loaded.failed > 0) {
                const proceed = await openAppConfirm({
                    title: 'Export without some graphs?',
                    message: `${loaded.failed} graph(s) could not be loaded and will be missing from the export.`,
                    confirmLabel: 'Export anyway',
                    cancelLabel: 'Cancel',
                    danger: false
                });
                if (!proceed) return;
            }
        }
        const normalized = brews.map((brew) => {
            const typeDisplay = getCoffeeTypeDisplay(brew);
            const type = getCoffeeTypeForBrew(brew);
            // The export is self-contained: the brew's coffee and grinder are written into it.
            return {
                ...withoutFields(brew, BREW_DUPLICATE_FIELDS),
                grinder: getBrewGrinderName(brew, getGasItems?.() || []),
                coffeeType: {
                    id: type?.id || null,
                    roaster: typeDisplay.roaster,
                    farmer: typeDisplay.farmer,
                    origin: typeDisplay.origin,
                    variety: typeDisplay.variety,
                    processing: typeDisplay.processing,
                    roastType: typeDisplay.roastType
                }
            };
        });
        // A Blob rather than a data: URL, which browsers cut off at a few megabytes.
        const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(normalized, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.setAttribute('href', blobUrl);
        link.setAttribute('download', 'coffee_log.json');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    };

    const exportCoffeesAsCSV = () => {
        const headers = ['Name', 'Roaster', 'Roast date', 'Roast type', 'Degree of Roast', 'Custom degree of Roast', 'Blend', 'Weight', 'Cost', 'Flavour profile', 'Cupping points', 'Decaffeinated', 'Website', 'EAN / Articlenumber', 'Notes', 'Rating', 'Archived', 'Frozen Date', 'Unfrozen Date', 'Freezing Storage Type', 'Frozen Note', '1. Country', '1. Region', '1. Farm', '1. Farmer', '1. Elevation', '1. Variety', '1. Processing', '1. Harvested', '1. Percentage', '1. Bean certification', '1. Fob Price', '1. Purchasing Price'];
        const sourceBeans = getBeans();
        const esc = (t) => {
            if (t === null || t === undefined) return '';
            const str = String(t);
            if (str.includes(';') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
            return str;
        };
        const typeFor = (bean) => (getCoffeeTypes?.() || []).find((ct) => ct.id === bean.coffeeTypeId) || {};
        const rows = sourceBeans.map((bean) => typeFor(bean)).map((coffee) => [
            esc(coffee.farmer || ''), esc(coffee.roaster || ''), '', '', esc(coffee.roast || coffee.roastType || ''), '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', esc(coffee.origin || ''), '', '', '', '', esc(coffee.variety || ''), esc(coffee.processing || ''), '', '', '', '', ''
        ]);
        const csvContent = `data:text/csv;charset=utf-8,${headers.join(';')}\n${rows.map((e) => e.join(';')).join('\n')}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'coffee_beans.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportCoffeesAsJSON = () => {
        const sourceBeans = getBeans().map((bean) => {
            const type = bean.coffeeTypeId ? getCoffeeTypes().find((ct) => ct.id === bean.coffeeTypeId) : null;
            const normalized = {
                roaster: type?.roaster || null,
                farmer: type?.farmer || null,
                origin: type?.origin || null,
                variety: type?.variety || null,
                processing: type?.processing || null,
                roastType: type?.roast || type?.roastType || null
            };
            return {
                ...bean,
                coffeeType: {
                    id: type?.id || null,
                    roaster: normalized.roaster,
                    farmer: normalized.farmer,
                    origin: normalized.origin,
                    variety: normalized.variety,
                    processing: normalized.processing,
                    roastType: normalized.roastType
                }
            };
        });
        const jsonContent = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(sourceBeans, null, 2))}`;
        const link = document.createElement('a');
        link.setAttribute('href', jsonContent);
        link.setAttribute('download', 'coffee_beans.json');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return {
        resetImportState,
        renderImportPreview,
        openImportExportModal,
        closeImportExportModal,
        setImportExportMode,
        openImportModal,
        closeImportModal,
        handleImportFileChange,
        performImport,
        openExportModal,
        closeExportModal,
        performExport,
        exportBrewsAsCSV,
        exportBrewsAsBeanconquerorCSV,
        exportAsJSON,
        exportCoffeesAsCSV,
        exportCoffeesAsJSON
    };
};
