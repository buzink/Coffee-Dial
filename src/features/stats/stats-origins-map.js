import { WORLD_MAP_COUNTRIES, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH } from './world-map.data.js';
import { getOriginMacroRegion, ORIGIN_MACRO_REGIONS } from '../../core/origin-regions.js';

const normalize = (value) =>
    (value || '')
        .toString()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[’`]/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

// Origin text (English, Dutch, or a growing region) → country name on the map.
const ALIASES = {
    brasil: 'Brazil', brazilie: 'Brazil',
    ethiopie: 'Ethiopia', kenia: 'Kenya', oeganda: 'Uganda', kameroen: 'Cameroon',
    'dr congo': 'Dem. Rep. Congo', drc: 'Dem. Rep. Congo', 'democratic republic of the congo': 'Dem. Rep. Congo',
    'democratische republiek congo': 'Dem. Rep. Congo', 'republic of the congo': 'Congo',
    'ivory coast': "Côte d'Ivoire", ivoorkust: "Côte d'Ivoire",
    'dominican republic': 'Dominican Rep.', 'dominicaanse republiek': 'Dominican Rep.',
    'south sudan': 'S. Sudan', 'zuid-soedan': 'S. Sudan', soedan: 'Sudan',
    jemen: 'Yemen', 'saoedi-arabie': 'Saudi Arabia',
    indonesie: 'Indonesia', sumatra: 'Indonesia', java: 'Indonesia', sulawesi: 'Indonesia', bali: 'Indonesia',
    flores: 'Indonesia', aceh: 'Indonesia', 'papoea-nieuw-guinea': 'Papua New Guinea', png: 'Papua New Guinea',
    burma: 'Myanmar', yunnan: 'China', filipijnen: 'Philippines',
    'east timor': 'Timor-Leste', 'oost-timor': 'Timor-Leste', timor: 'Timor-Leste',
    australie: 'Australia', maleisie: 'Malaysia', korea: 'South Korea', 'zuid-korea': 'South Korea',
    hawaii: 'United States of America', usa: 'United States of America', 'united states': 'United States of America',
    'verenigde staten': 'United States of America', mexico: 'Mexico', peru: 'Peru',
    'salvador': 'El Salvador', tanzania: 'Tanzania', 'new caledonia': 'New Caledonia', 'nieuw-caledonie': 'New Caledonia',
    'puerto rico': 'Puerto Rico', china: 'China', jamaica: 'Jamaica'
};

const MAP_NAME_BY_KEY = new Map(WORLD_MAP_COUNTRIES.map(([name]) => [normalize(name), name]));
const countryFor = (text) => MAP_NAME_BY_KEY.get(text) || ALIASES[text] || null;

// One origin, or a blend like "Brazil, Colombia" → the countries on the map it names.
export const originCountries = (origin) => {
    const text = normalize(origin);
    if (!text || text === '-') return [];
    const whole = countryFor(text);
    if (whole) return [whole];
    const parts = text.split(/\s*(?:,|\/|&|\+|;|\band\b|\ben\b)\s*/).filter(Boolean);
    return [...new Set(parts.map(countryFor).filter(Boolean))];
};

const SVG_NS = 'http://www.w3.org/2000/svg';
let activeOriginsClick = null;
let activeOriginsKey = null;
const plural = (n, word) => `${n} ${n === 1 ? word : word === 'country' ? 'countries' : `${word}s`}`;

// Shows the chips that fit on one line and hides the rest; runs again when the width changes.
const fitOnOneLine = (list) => {
    const fit = () => {
        const chips = [...list.children];
        chips.forEach((chip) => { chip.hidden = false; });
        if (!list.clientWidth) return;
        const right = list.getBoundingClientRect().right + 0.5;
        chips.forEach((chip) => {
            if (chip.getBoundingClientRect().right > right) chip.hidden = true;
        });
    };
    fit();
    list._originsResize?.disconnect();
    if (typeof ResizeObserver === 'function') {
        let lastWidth = list.clientWidth;
        list._originsResize = new ResizeObserver(() => {
            if (list.clientWidth === lastWidth) return;
            lastWidth = list.clientWidth;
            fit();
        });
        list._originsResize.observe(list);
    }
};

// Countries shaded by how many different coffees came from them (in the brews shown), with the
// macro-regions top right of the card and, for a tapped country, its micro-regions in place of
// the country labels.
export const renderOriginsMap = ({ brews = [], getCoffeeTypeDisplay, getCoffeeTypeForBrew }) => {
    const host = document.getElementById('statsOriginsMap');
    const caption = document.getElementById('statsOriginsCaption');
    const list = document.getElementById('statsOriginsList');
    const regionList = document.getElementById('statsOriginsRegions');
    if (!host) return;

    const byCountry = new Map();
    const byMacroRegion = new Map();
    const unplaced = new Set();
    brews.forEach((brew) => {
        const display = getCoffeeTypeDisplay(brew);
        const origin = display?.origin;
        const coffeeKey = getCoffeeTypeForBrew?.(brew)?.id || brew.beanId || `${display?.roaster}|${display?.name}|${display?.farmer}|${origin}`;
        const countries = originCountries(origin);
        const macroRegions = new Set(countries.map((country) => getOriginMacroRegion(country)).filter(Boolean));
        if (!macroRegions.size && display?.originMacroRegion) macroRegions.add(display.originMacroRegion);
        macroRegions.forEach((region) => {
            if (!byMacroRegion.has(region)) byMacroRegion.set(region, new Set());
            byMacroRegion.get(region).add(coffeeKey);
        });
        if (!countries.length) {
            if (origin && origin !== '-') unplaced.add(origin.toString().trim());
            return;
        }
        // A micro-region belongs to a country only when the coffee comes from one country.
        const microRegion = countries.length === 1 ? (display?.originMicroRegion || '').toString().trim() : '';
        countries.forEach((country) => {
            if (!byCountry.has(country)) byCountry.set(country, { coffees: new Set(), brews: 0, regions: new Map() });
            const entry = byCountry.get(country);
            entry.coffees.add(coffeeKey);
            entry.brews += 1;
            const regionKey = microRegion && microRegion !== '-' ? microRegion : '';
            if (!entry.regions.has(regionKey)) entry.regions.set(regionKey, new Set());
            entry.regions.get(regionKey).add(coffeeKey);
        });
    });
    const max = Math.max(1, ...[...byCountry.values()].map((e) => e.coffees.size));
    const levelFor = (count) => (count ? Math.max(1, Math.ceil((count / max) * 4)) : 0);
    const describe = (name, entry) => `${name}: ${plural(entry.coffees.size, 'coffee')}, ${plural(entry.brews, 'brew')}`;
    const summary = byCountry.size
        ? `${plural(byCountry.size, 'country')} of origin. Tap a country for details.`
        : 'No origins in these brews yet.';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`);
    svg.setAttribute('class', 'origins-map');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', byCountry.size
        ? `World map of coffee origins: ${[...byCountry].map(([name, e]) => describe(name, e)).join('; ')}`
        : 'World map of coffee origins: none yet');
    const pathByCountry = new Map();
    const chipByCountry = new Map();
    let selectedName = null;

    // Micro-regions of the selected country with their number of coffees; coffees without one last.
    const renderRegions = (entry) => {
        if (!regionList) return;
        regionList.replaceChildren();
        [...entry.regions]
            .sort((a, b) => (a[0] === '') - (b[0] === '') || b[1].size - a[1].size || a[0].localeCompare(b[0]))
            .forEach(([region, coffees]) => {
                const li = document.createElement('li');
                li.className = 'origins-map-region';
                li.textContent = `${region || 'No region'} · ${coffees.size}`;
                li.title = `${region || 'No micro-region'}: ${plural(coffees.size, 'coffee')}`;
                regionList.appendChild(li);
            });
    };
    // A selected country shows its totals and its micro-regions in place of the country labels.
    const select = (name) => {
        const entry = byCountry.get(name);
        if (!entry) return;
        if (selectedName) pathByCountry.get(selectedName)?.classList.remove('is-selected');
        selectedName = name;
        pathByCountry.get(name)?.classList.add('is-selected');
        if (caption) caption.textContent = describe(name, entry);
        renderRegions(entry);
        if (regionList) regionList.hidden = false;
        if (list) list.hidden = true;
    };
    const deselect = () => {
        if (!selectedName) return;
        pathByCountry.get(selectedName)?.classList.remove('is-selected');
        selectedName = null;
        if (caption) caption.textContent = summary;
        if (regionList) regionList.hidden = true;
        if (list) {
            list.hidden = false;
            fitOnOneLine(list);
        }
    };

    WORLD_MAP_COUNTRIES.forEach(([name, d]) => {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        const entry = byCountry.get(name);
        path.setAttribute('data-level', String(levelFor(entry?.coffees.size || 0)));
        if (entry) {
            const title = document.createElementNS(SVG_NS, 'title');
            title.textContent = describe(name, entry);
            path.appendChild(title);
            path.dataset.originCountry = name;
            pathByCountry.set(name, path);
        }
        svg.appendChild(path);
    });

    const macro = document.getElementById('statsOriginsMacro');
    if (macro) {
        macro.replaceChildren();
        ORIGIN_MACRO_REGIONS.filter((region) => byMacroRegion.has(region)).forEach((region) => {
            const count = byMacroRegion.get(region).size;
            const li = document.createElement('li');
            const label = document.createElement('span');
            label.textContent = region;
            const value = document.createElement('strong');
            value.textContent = plural(count, 'coffee');
            li.append(label, value);
            macro.appendChild(li);
        });
        macro.hidden = !macro.children.length;
    }
    host.replaceChildren(svg);
    if (caption) caption.textContent = summary;
    if (regionList) {
        regionList.replaceChildren();
        regionList.hidden = true;
    }

    if (list) {
        const rows = [...byCountry].sort((a, b) => b[1].coffees.size - a[1].coffees.size || b[1].brews - a[1].brews);
        list.replaceChildren();
        list.hidden = false;
        rows.forEach(([name, entry]) => {
            const li = document.createElement('li');
            li.className = 'origins-map-chip is-clickable';
            li.dataset.level = String(levelFor(entry.coffees.size));
            li.dataset.originCountry = name;
            li.textContent = `${name} · ${entry.coffees.size}`;
            li.title = describe(name, entry);
            li.setAttribute('role', 'button');
            li.tabIndex = 0;
            chipByCountry.set(name, li);
            list.appendChild(li);
        });
        if (unplaced.size) {
            const li = document.createElement('li');
            li.className = 'origins-map-chip';
            li.dataset.level = '0';
            li.textContent = `Not on the map: ${[...unplaced].join(', ')}`;
            list.appendChild(li);
        }
        fitOnOneLine(list);
    }

    // One listener on the document: a country or its label selects it; a tap anywhere else,
    // including another spot in the card, deselects. Replaced on every render.
    if (activeOriginsClick) document.removeEventListener('click', activeOriginsClick, true);
    if (activeOriginsKey) document.removeEventListener('keydown', activeOriginsKey, true);
    activeOriginsClick = (event) => {
        const target = event.target instanceof Element ? event.target.closest('[data-origin-country]') : null;
        const name = target && (pathByCountry.get(target.dataset.originCountry) === target || chipByCountry.get(target.dataset.originCountry) === target)
            ? target.dataset.originCountry
            : null;
        if (name) select(name);
        else deselect();
    };
    activeOriginsKey = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const target = event.target instanceof Element ? event.target : null;
        const name = target?.dataset?.originCountry;
        if (name && chipByCountry.get(name) === target) {
            event.preventDefault();
            select(name);
        }
    };
    document.addEventListener('click', activeOriginsClick, true);
    document.addEventListener('keydown', activeOriginsKey, true);
};
