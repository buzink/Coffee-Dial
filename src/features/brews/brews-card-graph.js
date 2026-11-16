import { createBrewsVmModule } from './brews.vm.js';
import { formatCoffeeLabel } from '../../core/coffee-display.js';

export const createBrewsCardGraphModule = ({
    getCurrentCardGraphData,
    setCurrentCardGraphData = null,
    loadBrewWithGraph = null,
    getCurrentCardCoffee,
    getCurrentCoffeeCardId,
    getBrewTableOrder,
    getCoffeeTypeDisplay,
    dispatchCommand,
    ensureGraphModalsMounted = null
}) => {
    const brewsVm = createBrewsVmModule();
    let graphLoadFailed = false;
    let graphOpenRequest = 0;
    const EMPTY_GRAPH = {
        capture: { startAt: null, samples: [] },
        flowCapture: { startAt: null, samples: [] },
        rawCapture: { startAt: null, samples: [] },
        scale2Capture: { startAt: null, samples: [] },
        scale2FlowCapture: { startAt: null, samples: [] }
    };

    // The captures live in their own document; fetch them the first time the graph is opened.
    const ensureCurrentCardGraphData = async () => {
        graphLoadFailed = false;
        const existing = getCurrentCardGraphData();
        if (existing) return existing;
        const brew = getCurrentCardCoffee();
        if (!brew || brew.hasGraph !== true || typeof loadBrewWithGraph !== 'function') return null;
        const brewId = brew.id;
        const withGraph = await loadBrewWithGraph(brew);
        // The user may have moved to another card while the graph was loading.
        if (getCurrentCoffeeCardId() !== brewId) return getCurrentCardGraphData();
        const graphVm = brewsVm.buildCardGraphData(withGraph);
        if (!graphVm.graphData) {
            graphLoadFailed = withGraph === brew;
            return null;
        }
        setCurrentCardGraphData?.(graphVm.graphData);
        return graphVm.graphData;
    };

    const updateCoffeeGraphNav = () => {
        const order = getBrewTableOrder();
        const idx = order.indexOf(getCurrentCoffeeCardId());
        const prevBtn = document.getElementById('cardGraphPrevBtn');
        const nextBtn = document.getElementById('cardGraphNextBtn');
        if (!prevBtn || !nextBtn) return;
        prevBtn.disabled = idx <= 0;
        nextBtn.disabled = idx === -1 || idx >= order.length - 1;
        prevBtn.classList.toggle('opacity-40', prevBtn.disabled);
        prevBtn.classList.toggle('cursor-not-allowed', prevBtn.disabled);
        nextBtn.classList.toggle('opacity-40', nextBtn.disabled);
        nextBtn.classList.toggle('cursor-not-allowed', nextBtn.disabled);
    };

    const openCardGraphModal = async (e, forceOpen = false) => {
        if (e) e.stopPropagation();
        // Opening is asynchronous (the modal and the graph may still have to load). Each call
        // supersedes the ones before it, so paging quickly never lets an older brew's result
        // draw over a newer one.
        graphOpenRequest += 1;
        const request = graphOpenRequest;
        const isStale = () => request !== graphOpenRequest;
        if (typeof ensureGraphModalsMounted === 'function') {
            await ensureGraphModalsMounted();
            if (isStale()) return;
        }
        const brewAtOpen = getCurrentCardCoffee() || {};
        const needsLoad = !getCurrentCardGraphData() && brewAtOpen.hasGraph === true;
        if (!getCurrentCardGraphData() && !needsLoad && !forceOpen) return;

        const modal = document.getElementById('cardGraphModal');
        if (!modal) return;
        modal.classList.remove('hidden');

        const canvas = document.getElementById('cardGraphCanvas');
        const emptyEl = document.getElementById('cardGraphEmpty');
        const subtitleEl = document.getElementById('cardGraphSubtitle');
        const dateEl = document.getElementById('cardGraphDate');
        const inputWeightEl = document.getElementById('cardGraphInputWeight');
        const inputRatioEl = document.getElementById('cardGraphInputRatio');
        const inputYieldEl = document.getElementById('cardGraphInputYield');
        const firstDripEl = document.getElementById('cardGraphFirstDrip');
        const maxFlowEl = document.getElementById('cardGraphMaxFlow');
        const avgFlowEl = document.getElementById('cardGraphAvgFlow');

        const c = getCurrentCardCoffee() || {};

        if (subtitleEl) {
            const typeDisplay = getCoffeeTypeDisplay(c);
            const roaster = typeDisplay.roaster !== '-' ? typeDisplay.roaster : 'Unknown Roaster';
            const farmer = formatCoffeeLabel(typeDisplay);
            const method = c.method || '-';
            subtitleEl.textContent = `${roaster} ${farmer} (${method})`;
        }

        if (dateEl) {
            const formatDateTime = (value) => {
                if (!value) return '-';
                const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
                if (isNaN(dateObj)) return '-';
                const dd = String(dateObj.getDate()).padStart(2, '0');
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const yy = String(dateObj.getFullYear()).slice(-2);
                const hh = String(dateObj.getHours()).padStart(2, '0');
                const min = String(dateObj.getMinutes()).padStart(2, '0');
                return `${dd}-${mm}-${yy} ${hh}:${min}`;
            };
            dateEl.textContent = formatDateTime(c.createdAt);
        }

        const weightVal = parseFloat(c.weight);
        const ratioVal = parseFloat(c.ratio);
        if (inputWeightEl) inputWeightEl.value = !isNaN(weightVal) ? weightVal : '';
        const ratioSpan = inputRatioEl?.querySelector('span:last-child');
        if (ratioSpan) ratioSpan.textContent = !isNaN(ratioVal) ? ratioVal.toFixed(2) : '';
        if (inputYieldEl) inputYieldEl.value = !isNaN(weightVal) && !isNaN(ratioVal) ? (weightVal * ratioVal).toFixed(1) : '';
        if (firstDripEl) firstDripEl.value = c.firstDrip ?? '';
        if (maxFlowEl) maxFlowEl.value = c.maxFlow ?? '';
        if (avgFlowEl) avgFlowEl.value = c.avgFlow ?? '';

        updateCoffeeGraphNav();

        const showEmptyState = async (message) => {
            // Drawing an empty graph also makes the renderer forget the previous brew's graph,
            // which it would otherwise redraw on hover.
            try {
                await dispatchCommand?.('scales.renderGraph', { canvasId: 'cardGraphCanvas', graphData: EMPTY_GRAPH });
            } catch (_) { /* the canvas is cleared below either way */ }
            if (isStale()) return;
            const ctx = canvas?.getContext?.('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (emptyEl) {
                if (emptyEl.dataset.defaultText === undefined) emptyEl.dataset.defaultText = emptyEl.textContent;
                emptyEl.textContent = message || emptyEl.dataset.defaultText;
                emptyEl.classList.remove('hidden');
            }
        };

        if (needsLoad) await showEmptyState('Loading graph...');
        if (isStale()) return;
        const currentGraphData = await ensureCurrentCardGraphData();
        if (isStale()) return;

        let rendered = false;
        if (currentGraphData) {
            try {
                const result = await dispatchCommand?.('scales.renderGraph', {
                    canvasId: 'cardGraphCanvas',
                    graphData: currentGraphData
                });
                rendered = !!result;
            } catch (error) {
                console.error('Card graph render command failed:', error);
            }
        }

        if (isStale()) return;
        if (rendered) {
            if (emptyEl) emptyEl.classList.add('hidden');
        } else {
            await showEmptyState(
                graphLoadFailed ? 'The graph could not be loaded. Check your connection and try again.' : ''
            );
        }
    };

    const closeCardGraphModal = (e) => {
        if (!e || e.target.id === 'cardGraphModal' || e.target.closest('button')) {
            const modal = document.getElementById('cardGraphModal');
            if (modal) modal.classList.add('hidden');
        }
    };

    const navigateCoffeeCardFromGraph = async (direction) => {
        const order = getBrewTableOrder();
        const idx = order.indexOf(getCurrentCoffeeCardId());
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= order.length) return;
        // Wait until the card has switched; the graph is read from the card that is open.
        await dispatchCommand?.('brews.openCard', { id: order[nextIdx], event: null, options: { keepNavigationOrder: true } });
        await openCardGraphModal(null, true);
    };

    return {
        openCardGraphModal,
        closeCardGraphModal,
        updateCoffeeGraphNav,
        navigateCoffeeCardFromGraph
    };
};
