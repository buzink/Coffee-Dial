import { createCoffeeDisplayModule, formatCoffeeWithRoaster } from '../../core/coffee-display.js';
import { getBrewGrinderName } from '../../core/brew-fields.js';
import { renderOriginsMap } from './stats-origins-map.js';
import { altitudeBand } from '../../core/altitude.js';

export const createStatsModule = ({
    getCurrentUser,
    getCurrentView,
    getFollowing,
    dataService,
    getCoffeeTypeDisplay: injectedGetCoffeeTypeDisplay,
    getBeanCoffeeTypeDisplay: injectedGetBeanCoffeeTypeDisplay,
    getCoffeeTypeForBrew: injectedGetCoffeeTypeForBrew,
    dispatchCommand,
    setCurrentStatsData,
    getCurrentStatsData,
    setCurrentBeanMeterPeriod,
    getCurrentBeanMeterPeriod,
    getChart
}) => {
    const { db, collection, getDocs } = dataService || {};
    if (!db || !collection || !getDocs) {
        throw new Error('createStatsModule requires dataService { db, collection, getDocs }');
    }
    const chartInstances = {};
    let currentStatsUid = 'mine';
    let currentStatsPeriod = 'all';
    let loadedStats = null;
    let loadSeq = 0;

    const dateMs = (value) => {
        if (!value) return NaN;
        const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
        return dateObj instanceof Date ? dateObj.getTime() : NaN;
    };
    // Start of the chosen period, or null for all time.
    const getPeriodStart = (period, now = new Date()) => {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (period === '7d') start.setDate(start.getDate() - 6);
        else if (period === '30d') start.setDate(start.getDate() - 29);
        else if (period === '90d') start.setMonth(start.getMonth() - 3);
        else if (period === '365d') start.setFullYear(start.getFullYear() - 1);
        else if (period === 'year') start.setMonth(0, 1);
        else return null;
        return start;
    };
    // Brews made in the period, gear bought in it, and bags that were open at some point during it.
    const filterByPeriod = ({ brews, gear, beans }, period) => {
        const start = getPeriodStart(period);
        if (!start) return { brews, gear, beans };
        const startMs = start.getTime();
        return {
            brews: brews.filter((b) => dateMs(b.createdAt) >= startMs),
            gear: gear.filter((g) => dateMs(g.purchasedDate) >= startMs),
            beans: beans.filter((bean) => {
                const endMs = bean?.archived ? dateMs(bean.archivedDate) : Date.now();
                return !Number.isFinite(endMs) || endMs >= startMs;
            })
        };
    };
    const applyStatsPeriod = async () => {
        if (!loadedStats) return;
        const { brews, gear, beans } = filterByPeriod(loadedStats, currentStatsPeriod);
        // Look coffees up through all of the person's bags, also those outside the period.
        const lookup = createCoffeeDisplayModule({
            getBeans: () => loadedStats.beans,
            getCoffeeTypes: () => loadedStats.coffeeTypes || []
        });
        await calculateStats(brews, gear, beans, lookup);
    };
    const changeStatsPeriod = async (period) => {
        currentStatsPeriod = period || 'all';
        const sel = document.getElementById('statsPeriodSelect');
        if (sel && sel.value !== currentStatsPeriod) sel.value = currentStatsPeriod;
        await applyStatsPeriod();
    };
    const getChartCtor = async () => {
        try {
            if (typeof getChart === 'function') {
                const ctor = await getChart();
                if (typeof ctor === 'function') return ctor;
            }
        } catch (error) {
            console.error('Chart.js lazy-load failed:', error);
        }
        if (typeof window !== 'undefined' && typeof window.Chart === 'function') {
            return window.Chart;
        }
        return null;
    };
    const formatCurrencyEur = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return 'EUR 0.00';
        return `EUR ${num.toFixed(2)}`;
    };
    const renderGasAlert = (totalSpent = 0) => {
        const totalEl = document.getElementById('statGasTotal');
        const funnyEl = document.getElementById('statGasFunny');
        if (totalEl) totalEl.textContent = formatCurrencyEur(totalSpent);
        if (funnyEl) {
            if (totalSpent <= 0) funnyEl.textContent = 'Your wallet is still in pre-infusion mode.';
            else if (totalSpent < 250) funnyEl.textContent = 'Mild GAS symptoms detected. Your bank app is calm... for now.';
            else if (totalSpent < 1000) funnyEl.textContent = 'Classic GAS phase: one more grinder away from financial enlightenment.';
            else funnyEl.textContent = 'Full GAS syndrome. Your espresso is dialed in, your budget is not.';
        }
    };

    const closeStats = () => {
        document.getElementById('statsPage')?.classList.add('hidden');
        document.getElementById('aiProfileContainer')?.classList.add('hidden');
    };

    const toggleStatsUniqueTable = (show) => {
        const gen = document.getElementById('statsGeneralView');
        const uni = document.getElementById('statsUniqueTableView');
        if (!gen || !uni) return;
        if (show) {
            gen.classList.add('hidden');
            uni.classList.remove('hidden');
        } else {
            uni.classList.add('hidden');
            gen.classList.remove('hidden');
        }
    };

    const openStats = () => {
        const user = getCurrentUser();
        if (!user) return alert('Please sign in first.');
        document.getElementById('statsPage')?.classList.remove('hidden');
        const sl = document.getElementById('statsViewSelect');
        if (!sl) return;
        const following = Array.isArray(getFollowing?.()) ? getFollowing() : [];
        const hasFriendOptions = following.length > 0;
        sl.innerHTML = '<option value="mine">My brews</option>';
        following.forEach((f) => {
            const o = document.createElement('option');
            o.value = f.uid;
            o.text = f.name || `Friend (${f.uid.substr(0, 5)}...)`;
            sl.appendChild(o);
        });
        sl.value = hasFriendOptions ? getCurrentView() : 'mine';
        sl.classList.toggle('hidden', !hasFriendOptions);
        toggleStatsUniqueTable(false);
        changeStatsView(hasFriendOptions ? getCurrentView() : 'mine');
    };

    const changeStatsView = async (uid) => {
        currentStatsUid = uid;
        const seq = ++loadSeq;
        const user = getCurrentUser();
        const ownerUid = uid === 'mine' ? user.uid : uid;
        const readAll = async (name) => {
            const snap = await getDocs(collection(db, 'users', ownerUid, name));
            const rows = [];
            snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
            return rows;
        };
        // That person's own bags and coffees too: a brew's coffee details live only there.
        const [dataToUse, gearToUse, beansToUse, coffeeTypesToUse] = await Promise.all(
            ['coffees', 'gear', 'beans', 'coffeeTypes'].map(readAll)
        );
        if (seq !== loadSeq) return;
        loadedStats = { brews: dataToUse, gear: gearToUse, beans: beansToUse, coffeeTypes: coffeeTypesToUse };
        await applyStatsPeriod();
    };

    // The most common value as a word; Unknown only when nothing else was recorded.
    // Share of the coffees (with an altitude) that grew low, middle or high.
    const renderAltitude = (brews, getCoffeeTypeDisplay, getCoffeeTypeForBrew) => {
        const bandByCoffee = new Map();
        brews.forEach((brew) => {
            const key = getCoffeeTypeForBrew(brew)?.id || brew.beanId;
            if (!key || bandByCoffee.has(key)) return;
            bandByCoffee.set(key, altitudeBand(getCoffeeTypeDisplay(brew)?.altitude));
        });
        const bands = [...bandByCoffee.values()];
        const known = bands.filter(Boolean);
        const share = (band) => (known.length ? `${Math.round((known.filter((b) => b === band).length / known.length) * 100)}%` : '-');
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        setText('statAltitudeHigh', share('high'));
        setText('statAltitudeMiddle', share('middle'));
        setText('statAltitudeLow', share('low'));
        setText('statAltitudeNote', known.length
            ? `${known.length} of ${bands.length} ${bands.length === 1 ? 'coffee has' : 'coffees have'} an altitude`
            : 'No coffees with an altitude yet');
        document.getElementById('statsAltitudeChart')?.setAttribute('aria-label', known.length
            ? `Coffees by altitude: high ${share('high')}, middle ${share('middle')}, low ${share('low')}`
            : 'Coffees by altitude: none yet');
    };
    const renderTopShare = (id, dataObj = {}) => {
        const wordEl = document.getElementById(id);
        const shareEl = document.getElementById(`${id}Share`);
        if (!wordEl) return;
        const entries = Object.entries(dataObj).filter(([, count]) => count > 0);
        const total = entries.reduce((sum, [, count]) => sum + count, 0);
        const known = entries.filter(([label]) => label !== 'Unknown');
        const [label, count] = [...(known.length ? known : entries)].sort((a, b) => b[1] - a[1])[0] || [];
        wordEl.textContent = label || '-';
        if (shareEl) shareEl.textContent = label ? `${Math.round((count / total) * 100)}% of brews` : '';
    };
    const wireFlipCards = () => {
        document.querySelectorAll('[data-stats-flip]').forEach((btn) => {
            if (btn.dataset.flipWired) return;
            btn.dataset.flipWired = '1';
            btn.addEventListener('click', () => {
                const card = btn.closest('.stats-flip-card');
                const flipped = !card.classList.contains('is-flipped');
                card.classList.toggle('is-flipped', flipped);
                btn.setAttribute('aria-pressed', String(flipped));
                btn.title = flipped ? 'Show most common' : 'Show distribution';
                btn.querySelector('i')?.classList.replace(flipped ? 'fa-chart-pie' : 'fa-font', flipped ? 'fa-font' : 'fa-chart-pie');
                card.querySelector('.stats-flip-front')?.setAttribute('aria-hidden', String(flipped));
                card.querySelector('.stats-flip-back')?.setAttribute('aria-hidden', String(!flipped));
            });
        });
    };
    const renderCharts = async (roast, method, drink, stars, brewTimes = { weekday: Array(7).fill(0), hour: Array(24).fill(0) }, processing = {}, variety = {}) => {
        const chartCtor = await getChartCtor();
        if (!chartCtor) return;
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#e7e5e4' : '#4a3b32';
        const gridColor = isDark ? '#44403c' : '#e5e7eb';

        const createPie = (ctxId, dataObj, colors) => {
            if (chartInstances[ctxId]) chartInstances[ctxId].destroy();
            const ctx = document.getElementById(ctxId).getContext('2d');
            chartInstances[ctxId] = new chartCtor(ctx, {
                type: 'doughnut',
                data: { labels: Object.keys(dataObj), datasets: [{ data: Object.values(dataObj), backgroundColor: colors, borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor, font: { size: 10, family: "'Outfit', sans-serif" }, boxWidth: 10 } } } }
            });
        };

        const roastColors = ['#fcd34d', '#f97316', '#78350f', '#000000', '#9ca3af'];
        const methodColors = ['#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fbbf24', '#9ca3af', '#f87171', '#2dd4bf'];
        const drinkColors = ['#fb923c', '#c084fc', '#22d3ee', '#4ade80', '#e879f9', '#9ca3af'];
        createPie('chartRoast', roast, roastColors);
        createPie('chartMethod', method, methodColors);
        createPie('chartDrink', drink, drinkColors);
        createPie('chartProcessing', processing, ['#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#60a5fa', '#fb923c', '#9ca3af']);
        createPie('chartVariety', variety, ['#f87171', '#60a5fa', '#facc15', '#4ade80', '#c084fc', '#2dd4bf', '#fb923c', '#e879f9', '#9ca3af']);
        renderTopShare('statTopRoast', roast);
        renderTopShare('statTopMethod', method);
        renderTopShare('statTopDrink', drink);
        renderTopShare('statTopProcessing', processing);
        renderTopShare('statTopVariety', variety);
        wireFlipCards();

        if (chartInstances.chartStars) chartInstances.chartStars.destroy();
        const ctxStars = document.getElementById('chartStars').getContext('2d');
        const starCounts = [1, 2, 3, 4, 5].map((i) => stars[i] || 0);
        chartInstances.chartStars = new chartCtor(ctxStars, {
            type: 'bar',
            data: { labels: ['1★', '2★', '3★', '4★', '5★'], datasets: [{ label: 'Count', data: starCounts, backgroundColor: '#fbbf24', borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: textColor, precision: 0 }, grid: { color: gridColor } }, x: { ticks: { color: textColor }, grid: { display: false } } } }
        });

        const createBar = (ctxId, labels, data, color, autoSkip = false) => {
            if (chartInstances[ctxId]) chartInstances[ctxId].destroy();
            const canvas = document.getElementById(ctxId);
            if (!canvas) return;
            chartInstances[ctxId] = new chartCtor(canvas.getContext('2d'), {
                type: 'bar',
                data: { labels, datasets: [{ label: 'Brews', data, backgroundColor: color, borderRadius: 4 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: textColor, precision: 0 }, grid: { color: gridColor } }, x: { ticks: { color: textColor, autoSkip, maxRotation: 0 }, grid: { display: false } } } }
            });
        };
        createBar('chartWeekday', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], brewTimes.weekday, '#a78bfa');
        // Hours from the earliest to the latest hour with a brew, so the night does not take up the chart.
        const usedHours = brewTimes.hour.map((count, h) => (count > 0 ? h : null)).filter((h) => h !== null);
        const firstHour = usedHours.length ? usedHours[0] : 6;
        const lastHour = usedHours.length ? usedHours[usedHours.length - 1] : 22;
        const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
        createBar('chartHour', hours.map(String), hours.map((h) => brewTimes.hour[h]), '#60a5fa', true);
    };

    const renderTopList = (id, items, emptyText) => {
        const listEl = document.getElementById(id);
        if (!listEl) return;
        listEl.replaceChildren();
        if (!items.length) {
            const empty = document.createElement('li');
            empty.className = 'text-sm text-gray-400 italic';
            empty.textContent = emptyText;
            listEl.appendChild(empty);
            return;
        }
        items.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'flex items-center gap-3 bg-coffee-50 dark:bg-[#1c1917] p-2 rounded border border-coffee-100 dark:border-[#44403c]';
            if (item.onClick) {
                li.classList.add('cursor-pointer', 'hover:border-coffee-300', 'dark:hover:border-[#78716c]');
                li.setAttribute('role', 'button');
                li.tabIndex = 0;
                li.onclick = item.onClick;
                li.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.onClick(); } };
            }
            const rank = document.createElement('span');
            rank.className = 'text-sm font-bold text-coffee-400 dark:text-[#78716c] w-4 text-center';
            rank.textContent = String(index + 1);
            const text = document.createElement('div');
            text.className = 'min-w-0 flex-1';
            const title = document.createElement('span');
            title.className = 'font-bold text-coffee-800 dark:text-white text-sm block truncate';
            title.textContent = item.title;
            const subtitle = document.createElement('span');
            subtitle.className = 'text-xs text-coffee-500 dark:text-[#78716c] block truncate';
            subtitle.textContent = item.subtitle || '';
            text.append(title, subtitle);
            const badge = document.createElement('span');
            badge.className = 'text-xs font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-1 rounded-full whitespace-nowrap';
            badge.textContent = item.badge;
            li.append(rank, text, badge);
            listEl.appendChild(li);
        });
    };

    const calculateStats = async (dataToUse, gearToUse = [], beansToUse = [], lookup = null) => {
        const getCoffeeTypeDisplay = lookup?.getCoffeeTypeDisplay || injectedGetCoffeeTypeDisplay;
        const getCoffeeTypeForBrew = lookup?.getCoffeeTypeForBrew || injectedGetCoffeeTypeForBrew;
        const getBeanCoffeeTypeDisplay = lookup?.getBeanCoffeeTypeDisplay || injectedGetBeanCoffeeTypeDisplay;
        // Brews with their coffee attached (not saved), for the AI profile.
        setCurrentStatsData(dataToUse.map((brew) => ({ ...brew, coffee: getCoffeeTypeDisplay(brew) })));
        const gasTotalSpent = gearToUse.reduce((sum, item) => {
            const price = Number(item?.price);
            return Number.isFinite(price) ? sum + price : sum;
        }, 0);
        renderGasAlert(gasTotalSpent);
        const oneDay = 24 * 60 * 60 * 1000;
        const toMs = (value) => {
            if (!value) return NaN;
            const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
            return dateObj instanceof Date ? dateObj.getTime() : NaN;
        };
        const beanName = (bean) => formatCoffeeWithRoaster(
            typeof getBeanCoffeeTypeDisplay === 'function' ? getBeanCoffeeTypeDisplay(bean) : bean || {},
            'Unnamed bag'
        );
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        const formatDuration = (ms) => {
            if (!Number.isFinite(ms) || ms < 0) return '-';
            const days = ms / oneDay;
            if (days < 1) return '< 1 day open';
            if (days < 10) return `${days.toFixed(1)} days open`;
            return `${Math.round(days)} days open`;
        };
        const openDurations = (beansToUse || [])
            .map((bean) => {
                const openedMs = toMs(bean?.openedDate);
                if (!Number.isFinite(openedMs)) return null;
                const archivedMs = toMs(bean?.archivedDate);
                const isArchived = !!bean?.archived;
                if (isArchived && !Number.isFinite(archivedMs)) return null;
                const endMs = isArchived && Number.isFinite(archivedMs) ? archivedMs : Date.now();
                const bagWeightGr = Number(bean?.stock);
                return {
                    id: bean.id,
                    name: beanName(bean),
                    isArchived,
                    bagWeightGr: Number.isFinite(bagWeightGr) && bagWeightGr > 0 ? bagWeightGr : null,
                    durationMs: Math.max(0, endMs - openedMs)
                };
            })
            .filter(Boolean);
        const shortestCandidates = openDurations
            .filter((item) => item.isArchived && Number.isFinite(item.bagWeightGr) && item.bagWeightGr > 0)
            .map((item) => ({
                ...item,
                durationMsPerGram: item.durationMs / item.bagWeightGr
            }));
        const longestCandidates = openDurations;
        const shortestCardEl = document.getElementById('statBeanShortestCard');
        const longestCardEl = document.getElementById('statBeanLongestCard');
        const wireCard = (el, beanId) => {
            if (!el) return;
            if (!beanId || currentStatsUid !== 'mine') {
                el.onclick = null;
                return;
            }
            el.onclick = () => {
                dispatchCommand?.('beans.openCard', { beanId, event: null, keepNavigationOrder: false });
            };
        };

        if (!shortestCandidates.length) {
            setText('statBeanShortestName', '-');
            setText('statBeanShortestTime', 'No finished bags with an opened date and weight');
            wireCard(shortestCardEl, null);
        } else {
            const shortest = [...shortestCandidates].sort((a, b) => a.durationMsPerGram - b.durationMsPerGram)[0];
            setText('statBeanShortestName', shortest.name);
            setText('statBeanShortestTime', formatDuration(shortest.durationMs));
            wireCard(shortestCardEl, shortest.id);
        }

        if (!longestCandidates.length) {
            setText('statBeanLongestName', '-');
            setText('statBeanLongestTime', 'No opened date found');
            wireCard(longestCardEl, null);
        } else {
            const longest = [...longestCandidates].sort((a, b) => b.durationMs - a.durationMs)[0];
            setText('statBeanLongestName', longest.name);
            setText('statBeanLongestTime', formatDuration(longest.durationMs));
            wireCard(longestCardEl, longest.id);
        }

        const total = dataToUse.length;
        if (total === 0) {
            document.getElementById('statTotalBrews').innerText = '0';
            document.getElementById('statMonthBrews').innerText = '∞';
            document.getElementById('statAvgBrews').innerText = '0';
            document.getElementById('statUniqueCoffees').innerText = '0';
            document.getElementById('mostBrewedName').innerText = '-';
            document.getElementById('mostBrewedCount').innerText = '0 brews';
            renderTopList('topCoffeesList', [], 'No brews found.');
            renderTopList('topBrewsList', [], 'No brews found.');
            document.getElementById('uniqueLeaderboardBody').innerHTML = "<tr><td colspan='3' class='text-center py-4 italic text-coffee-400'>No data.</td></tr>";
            document.getElementById('grinderStatsList').innerHTML = '<p class="text-sm text-gray-400 italic">No grinder data.</p>';
            renderOriginsMap({ brews: [], getCoffeeTypeDisplay, getCoffeeTypeForBrew });
            renderAltitude([], getCoffeeTypeDisplay, getCoffeeTypeForBrew);
            await renderCharts({}, {}, {}, {});
            await updateBeanMeterInternal();
            return;
        }

        const now = new Date();
        const periodStart = getPeriodStart(currentStatsPeriod, now);
        const firstDate = periodStart || new Date(Math.min(...dataToUse.map((c) => new Date(c.createdAt || now))));
        const diffDays = Math.max(1, Math.round(Math.abs((now - firstDate) / oneDay)));
        const avg = (total / diffDays).toFixed(1);
        const lastBrewDate = new Date(Math.max(...dataToUse.map((c) => new Date(c.createdAt || now))));
        const hoursSinceLastBrew = Math.round((now - lastBrewDate) / (60 * 60 * 1000));

        document.getElementById('statTotalBrews').innerText = total;
        document.getElementById('statMonthBrews').innerText = hoursSinceLastBrew;
        document.getElementById('statAvgBrews').innerText = avg;

        const agg = (key, getValue) => dataToUse.reduce((acc, c) => {
            const val = (getValue ? getValue(c) : c[key]) || 'Unknown';
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {});

        // The coffee display uses '-' for an empty field; count it as Unknown.
        const coffeeField = (field) => (c) => {
            const value = (getCoffeeTypeDisplay(c)[field] || '').toString().trim();
            return value && value !== '-' ? value : 'Unknown';
        };
        const roastData = agg(null, coffeeField('roastType'));
        const processingData = agg(null, coffeeField('processing'));
        const varietyData = agg(null, coffeeField('variety'));
        const methodData = agg('method');
        const drinkData = agg('drink');
        const ratingData = dataToUse.reduce((acc, c) => {
            const r = c.rating || 0;
            if (r > 0) acc[r] = (acc[r] || 0) + 1;
            return acc;
        }, {});
        const brewTimes = { weekday: Array(7).fill(0), hour: Array(24).fill(0) };
        dataToUse.forEach((c) => {
            const ms = toMs(c.createdAt);
            if (!Number.isFinite(ms)) return;
            const date = new Date(ms);
            brewTimes.weekday[(date.getDay() + 6) % 7]++;
            brewTimes.hour[date.getHours()]++;
        });
        renderOriginsMap({ brews: dataToUse, getCoffeeTypeDisplay, getCoffeeTypeForBrew });
        renderAltitude(dataToUse, getCoffeeTypeDisplay, getCoffeeTypeForBrew);
        await renderCharts(roastData, methodData, drinkData, ratingData, brewTimes, processingData, varietyData);
        await updateBeanMeterInternal('day');

        const uniqueMap = {};
        dataToUse.forEach((c) => {
            const type = getCoffeeTypeForBrew(c);
            const typeKey = type?.id || c.beanId || '-';
            const typeDisplay = getCoffeeTypeDisplay(c);
            if (!uniqueMap[typeKey]) uniqueMap[typeKey] = { typeId: type?.id || null, count: 0, label: formatCoffeeWithRoaster(typeDisplay, 'Unknown'), origin: typeDisplay.origin, totalRating: 0, ratingCount: 0 };
            uniqueMap[typeKey].count++;
            if (c.rating > 0) {
                uniqueMap[typeKey].totalRating += c.rating;
                uniqueMap[typeKey].ratingCount++;
            }
        });

        document.getElementById('statUniqueCoffees').innerText = Object.keys(uniqueMap).length;
        let maxKey = null;
        Object.keys(uniqueMap).forEach((k) => { if (!maxKey || uniqueMap[k].count > uniqueMap[maxKey].count) maxKey = k; });
        if (maxKey) {
            const d = uniqueMap[maxKey];
            document.getElementById('mostBrewedName').innerText = d.origin && d.origin !== '-' ? `${d.label} · ${d.origin}` : d.label;
            document.getElementById('mostBrewedCount').innerText = `${d.count} brews`;
        }

        const coffeeKeyForBrew = (c) => getCoffeeTypeForBrew(c)?.id || c.beanId || '-';
        const canOpen = currentStatsUid === 'mine';

        const topCoffees = Object.values(uniqueMap)
            .filter((u) => u.ratingCount > 0)
            .map((u) => ({ ...u, avg: u.totalRating / u.ratingCount }))
            .sort((a, b) => b.avg - a.avg || b.ratingCount - a.ratingCount || b.count - a.count)
            .slice(0, 3)
            .map((u) => ({
                title: u.label,
                subtitle: `${u.origin && u.origin !== '-' ? `${u.origin} · ` : ''}${u.count} ${u.count === 1 ? 'brew' : 'brews'}`,
                badge: `${u.avg.toFixed(1)} ★`,
                onClick: canOpen && u.typeId
                    ? () => dispatchCommand?.('coffees.openCard', { id: u.typeId, event: null })
                    : null
            }));
        renderTopList('topCoffeesList', topCoffees, 'No rated brews yet.');

        const seenCoffees = new Set();
        const topBrews = dataToUse
            .filter((c) => Number(c.rating) > 0)
            .sort((a, b) => Number(b.rating) - Number(a.rating) || (toMs(b.createdAt) || 0) - (toMs(a.createdAt) || 0))
            .filter((c) => {
                const key = coffeeKeyForBrew(c);
                if (seenCoffees.has(key)) return false;
                seenCoffees.add(key);
                return true;
            })
            .slice(0, 3)
            .map((c) => {
                const createdMs = toMs(c.createdAt);
                const date = Number.isFinite(createdMs)
                    ? new Date(createdMs).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                    : '';
                return {
                    title: uniqueMap[coffeeKeyForBrew(c)]?.label || formatCoffeeWithRoaster(getCoffeeTypeDisplay(c), 'Unknown'),
                    subtitle: [c.method, c.drink, date].filter((v) => v && v !== '-').join(' · '),
                    badge: `${Number(c.rating)} ★`,
                    onClick: canOpen && c.id ? () => dispatchCommand?.('brews.openCard', { id: c.id, event: null }) : null
                };
            });
        renderTopList('topBrewsList', topBrews, 'No rated brews yet.');

        const leaderboardData = Object.values(uniqueMap).map((u) => ({ ...u, avg: u.ratingCount > 0 ? (u.totalRating / u.ratingCount).toFixed(1) : '0.0' })).sort((a, b) => b.avg - a.avg);
        const lbBody = document.getElementById('uniqueLeaderboardBody');
        lbBody.innerHTML = leaderboardData.length ? '' : "<tr><td colspan='3' class='text-center py-4 italic text-coffee-400'>No data.</td></tr>";
        leaderboardData.forEach((item) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="px-4 py-3 font-bold">${item.label}</td><td class="px-4 py-3">${item.origin}</td><td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-bold">${item.avg} ★</span></td>`;
            lbBody.appendChild(tr);
        });

        const grinderTotals = {};
        dataToUse.forEach((c) => {
            const grinder = getBrewGrinderName(c, gearToUse) || 'Unknown';
            const weight = parseFloat(c.weight);
            if (!isNaN(weight) && weight > 0) grinderTotals[grinder] = (grinderTotals[grinder] || 0) + weight;
        });

        const grinderList = Object.entries(grinderTotals).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
        const grinderEl = document.getElementById('grinderStatsList');
        grinderEl.innerHTML = '';
        if (!grinderList.length) grinderEl.innerHTML = '<p class="text-sm text-gray-400 italic">No grinder data.</p>';
        else grinderList.forEach((item) => {
            const kg = (item.total / 1000).toFixed(2);
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-coffee-50 dark:bg-[#1c1917] p-2 rounded border border-coffee-100 dark:border-[#44403c]';
            row.innerHTML = `<span class="text-sm font-semibold text-coffee-800 dark:text-white truncate pr-2">${item.name}</span><span class="text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-1 rounded-full whitespace-nowrap">${kg} kg</span>`;
            grinderEl.appendChild(row);
        });
    };

    const toLocalDayKey = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const parseLocalDayKey = (key) => {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const updateBeanMeterInternal = async (period) => {
        const chartCtor = await getChartCtor();
        if (!chartCtor) return;
        if (period) setCurrentBeanMeterPeriod(period);
        const currentBeanMeterPeriod = getCurrentBeanMeterPeriod();

        const btns = document.querySelectorAll('.bean-meter-btn');
        btns.forEach((btn) => {
            if (btn.textContent.toLowerCase() === currentBeanMeterPeriod) {
                btn.className = 'bean-meter-btn px-2 py-0.5 text-[10px] rounded font-bold transition-all bg-white dark:bg-[#292524] shadow-sm text-coffee-800 dark:text-white';
            } else {
                btn.className = 'bean-meter-btn px-2 py-0.5 text-[10px] rounded font-bold transition-all text-coffee-500 dark:text-[#a8a29e]';
            }
        });

        const currentStatsData = getCurrentStatsData() || [];
        const data = currentStatsData.filter((c) => c.weight && c.createdAt && Number.isFinite(dateMs(c.createdAt)));

        // The start of the day, week (Monday), month or year a date falls in.
        const bucketStart = (date) => {
            const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            if (currentBeanMeterPeriod === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
            else if (currentBeanMeterPeriod === 'month') d.setDate(1);
            else if (currentBeanMeterPeriod === 'year') d.setMonth(0, 1);
            return d;
        };
        const bucketKey = (date) => {
            const d = bucketStart(date);
            if (currentBeanMeterPeriod === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (currentBeanMeterPeriod === 'year') return String(d.getFullYear());
            return toLocalDayKey(d);
        };
        const nextBucket = (d) => {
            if (currentBeanMeterPeriod === 'week') d.setDate(d.getDate() + 7);
            else if (currentBeanMeterPeriod === 'month') d.setMonth(d.getMonth() + 1);
            else if (currentBeanMeterPeriod === 'year') d.setFullYear(d.getFullYear() + 1);
            else d.setDate(d.getDate() + 1);
        };

        const groupedData = {};
        data.forEach((brew) => {
            const key = bucketKey(new Date(dateMs(brew.createdAt)));
            groupedData[key] = (groupedData[key] || 0) + (brew.weight || 0) * 10;
        });

        // Every day, week, month or year from the start of the chosen period (or the first brew
        // when all time is shown) up to today, so periods without brews show as empty.
        const now = new Date();
        const periodStart = getPeriodStart(currentStatsPeriod, now);
        const brewTimes = data.map((c) => dateMs(c.createdAt));
        const rangeStart = periodStart || (brewTimes.length ? new Date(Math.min(...brewTimes)) : null);
        if (!rangeStart) {
            if (chartInstances.chartBeanMeter) {
                chartInstances.chartBeanMeter.destroy();
                delete chartInstances.chartBeanMeter;
            }
            return;
        }
        const rangeEnd = new Date(Math.max(now.getTime(), ...brewTimes));
        const endKey = bucketKey(rangeEnd);
        const sortedKeys = [];
        const cursor = bucketStart(rangeStart);
        for (let key = bucketKey(cursor); key <= endKey; nextBucket(cursor), key = bucketKey(cursor)) {
            sortedKeys.push(key);
        }
        const isDayPeriod = currentBeanMeterPeriod === 'day';

        // ISO week of a Monday key, as "2026-52" (the year the week's Thursday falls in).
        const isoWeekLabel = (key) => {
            const thursday = parseLocalDayKey(key);
            thursday.setDate(thursday.getDate() + 3);
            const firstThursday = new Date(thursday.getFullYear(), 0, 4);
            firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
            const week = 1 + Math.round((thursday - firstThursday) / (7 * 24 * 60 * 60 * 1000));
            return `${thursday.getFullYear()}-${String(week).padStart(2, '0')}`;
        };
        const labels = currentBeanMeterPeriod === 'week' ? sortedKeys.map(isoWeekLabel) : sortedKeys;
        const values = sortedKeys.map((key) => groupedData[key] || 0);
        const canvas = document.getElementById('chartBeanMeter');
        if (!canvas) return;
        if (chartInstances.chartBeanMeter) chartInstances.chartBeanMeter.destroy();

        const ctx = canvas.getContext('2d');
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#e7e5e4' : '#4a3b32';
        const gridColor = isDark ? '#44403c' : '#e5e7eb';
        const barColor = '#8c7365';
        const tickLineColor = isDark ? '#ffffff' : '#000000';
        // The first bar always gets a label; after that every bar when fewer than 8 are shown,
        // otherwise every 7th.
        const labelEvery = labels.length < 8 ? 1 : 7;
        const showsLabel = (index) => index % labelEvery === 0;
        const xScale = {
            ticks: {
                color: textColor,
                autoSkip: false,
                // Dates in the day view are always slanted; other labels only when they do not fit.
                ...(isDayPeriod ? { minRotation: 45, maxRotation: 45 } : {}),
                // Returning null hides the label and that tick's line.
                callback: (value, index) => {
                    if (!showsLabel(index)) return null;
                    return isDayPeriod
                        ? parseLocalDayKey(sortedKeys[index]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : labels[index];
                }
            },
            // A short tick line from each label up to the bottom of its bar.
            grid: {
                display: true,
                offset: false,
                drawOnChartArea: false,
                drawTicks: true,
                tickLength: 6,
                lineWidth: 1,
                color: tickLineColor
            }
        };

        chartInstances.chartBeanMeter = new chartCtor(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Beans Consumed', data: values, backgroundColor: barColor, borderRadius: 4 }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (context) => ` ${context.parsed.y.toLocaleString()} beans` } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { color: textColor, precision: 0 }, grid: { color: gridColor } },
                    x: xScale
                }
            }
        });
    };

    return {
        openStats,
        closeStats,
        toggleStatsUniqueTable,
        changeStatsView,
        changeStatsPeriod,
        calculateStats,
        updateBeanMeter: updateBeanMeterInternal,
        renderCharts
    };
};
