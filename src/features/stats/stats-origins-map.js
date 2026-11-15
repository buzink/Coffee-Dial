import { WORLD_MAP_COUNTRIES, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH } from './world-map.data.js';

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
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Countries shaded by how many different coffees came from them (in the brews shown).
export const renderOriginsMap = ({ brews = [], getCoffeeTypeDisplay, getCoffeeTypeForBrew }) => {
    const host = document.getElementById('statsOriginsMap');
    const caption = document.getElementById('statsOriginsCaption');
    const list = document.getElementById('statsOriginsList');
    if (!host) return;

    const byCountry = new Map();
    const unplaced = new Set();
    brews.forEach((brew) => {
        const display = getCoffeeTypeDisplay(brew);
        const origin = display?.origin;
        const coffeeKey = getCoffeeTypeForBrew?.(brew)?.id || brew.beanId || `${display?.roaster}|${display?.name}|${display?.farmer}|${origin}`;
        const countries = originCountries(origin);
        if (!countries.length) {
            if (origin && origin !== '-') unplaced.add(origin.toString().trim());
            return;
        }
        countries.forEach((country) => {
            if (!byCountry.has(country)) byCountry.set(country, { coffees: new Set(), brews: 0 });
            const entry = byCountry.get(country);
            entry.coffees.add(coffeeKey);
            entry.brews += 1;
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
    let selected = null;
    WORLD_MAP_COUNTRIES.forEach(([name, d]) => {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        const entry = byCountry.get(name);
        path.setAttribute('data-level', String(levelFor(entry?.coffees.size || 0)));
        if (entry) {
            const title = document.createElementNS(SVG_NS, 'title');
            title.textContent = describe(name, entry);
            path.appendChild(title);
            const show = () => {
                if (selected) selected.classList.remove('is-selected');
                selected = path;
                path.classList.add('is-selected');
                if (caption) caption.textContent = describe(name, entry);
            };
            path.addEventListener('click', show);
            path.addEventListener('mouseenter', show);
        }
        svg.appendChild(path);
    });
    host.replaceChildren(svg);
    if (caption) caption.textContent = summary;

    if (list) {
        const rows = [...byCountry].sort((a, b) => b[1].coffees.size - a[1].coffees.size || b[1].brews - a[1].brews);
        list.innerHTML = '';
        rows.forEach(([name, entry]) => {
            const li = document.createElement('li');
            li.className = 'origins-map-chip';
            li.dataset.level = String(levelFor(entry.coffees.size));
            li.textContent = `${name} · ${entry.coffees.size}`;
            li.title = describe(name, entry);
            list.appendChild(li);
        });
        if (unplaced.size) {
            const li = document.createElement('li');
            li.className = 'origins-map-chip';
            li.dataset.level = '0';
            li.textContent = `Not on the map: ${[...unplaced].join(', ')}`;
            list.appendChild(li);
        }
    }
};
