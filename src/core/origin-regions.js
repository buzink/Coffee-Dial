// Origin macro-region, worked out from the origin country.
export const ORIGIN_MACRO_REGIONS = ['Latin America', 'Africa & Arabia', 'Asia & Pacific'];

const COUNTRIES_BY_MACRO_REGION = {
    'Latin America': [
        'brazil', 'brasil', 'brazilie', 'colombia', 'peru', 'ecuador', 'bolivia', 'venezuela', 'mexico',
        'guatemala', 'honduras', 'el salvador', 'nicaragua', 'costa rica', 'panama', 'cuba',
        'dominican republic', 'dominicaanse republiek', 'haiti', 'jamaica', 'puerto rico', 'paraguay', 'argentina'
    ],
    'Africa & Arabia': [
        'ethiopia', 'ethiopie', 'kenya', 'kenia', 'rwanda', 'burundi', 'tanzania', 'uganda', 'oeganda', 'congo', 'dr congo',
        'drc', 'democratic republic of the congo', 'malawi', 'zambia', 'zimbabwe', 'cameroon', 'kameroen',
        'ivory coast', "cote d'ivoire", 'ivoorkust', 'madagascar', 'mozambique', 'south sudan', 'sudan',
        'nigeria', 'ghana', 'sierra leone', 'liberia', 'guinea', 'angola', 'togo', 'yemen', 'jemen',
        'saudi arabia', 'saoedi-arabie', 'oman'
    ],
    'Asia & Pacific': [
        'indonesia', 'indonesie', 'sumatra', 'java', 'sulawesi', 'bali', 'flores', 'aceh', 'papua new guinea',
        'papoea-nieuw-guinea', 'png', 'india', 'vietnam', 'laos', 'thailand', 'myanmar', 'burma', 'china',
        'yunnan', 'philippines', 'filipijnen', 'timor-leste', 'east timor', 'oost-timor', 'timor', 'nepal',
        'taiwan', 'japan', 'australia', 'australie', 'hawaii', 'malaysia', 'maleisie', 'sri lanka',
        'vanuatu', 'fiji', 'new caledonia', 'south korea', 'korea'
    ]
};

const MACRO_REGION_BY_COUNTRY = new Map(
    Object.entries(COUNTRIES_BY_MACRO_REGION).flatMap(([region, countries]) =>
        countries.map((country) => [country, region])
    )
);

const normalizeCountry = (value) =>
    (value || '')
        .toString()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[’`]/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

// One country, or a blend like "Brazil, Colombia": the macro-region when all parts agree, else ''.
export const getOriginMacroRegion = (country) => {
    const text = normalizeCountry(country);
    if (!text || text === '-') return '';
    const whole = MACRO_REGION_BY_COUNTRY.get(text);
    if (whole) return whole;
    const parts = text.split(/\s*(?:,|\/|&|\+|;|\band\b|\ben\b)\s*/).filter(Boolean);
    const regions = new Set(parts.map((part) => MACRO_REGION_BY_COUNTRY.get(part) || ''));
    if (regions.size !== 1) return '';
    return [...regions][0];
};

// "Micro-region, Country" for display, e.g. "Yirgacheffe, Ethiopia"; whichever is set when only one is.
export const formatOriginLabel = ({ origin, originMicroRegion } = {}, fallback = '') => {
    const clean = (value) => {
        const text = (value || '').toString().trim();
        return text && text !== '-' ? text : '';
    };
    return [clean(originMicroRegion), clean(origin)].filter(Boolean).join(', ') || fallback;
};

// Places in the country list that are really regions of a country (islands, provinces, states).
const REGION_LIKE_PLACES = new Set(['sumatra', 'java', 'sulawesi', 'bali', 'flores', 'aceh', 'yunnan', 'hawaii', 'timor']);

const foldChar = (char) => char.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, "'");
const SEPARATORS = /^[\s,;/|()\-–—.:]+|[\s,;/|()\-–—.:]+$/g;

// Splits an old free-text origin like "Yirgacheffe, Ethiopia" or "Colombia - Huila" into
// { country, microRegion }. Returns null when there is nothing to split: just a country,
// a blend of several countries, or no country we know.
export const splitOriginValue = (value) => {
    const original = (value || '').toString().trim();
    if (!original) return null;
    const folded = [...original].map((char) => (foldChar(char).length === 1 ? foldChar(char) : char.toLowerCase())).join('');
    if (folded.length !== original.length) return null;
    if (MACRO_REGION_BY_COUNTRY.has(normalizeCountry(original))) return null;

    const names = [...MACRO_REGION_BY_COUNTRY.keys()].sort((a, b) => b.length - a.length);
    const taken = new Array(folded.length).fill(false);
    const matches = [];
    names.forEach((name) => {
        const pattern = new RegExp(`(^|[^a-z])(${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^a-z])`, 'g');
        let match;
        while ((match = pattern.exec(folded))) {
            const start = match.index + match[1].length;
            const end = start + name.length;
            if (taken.slice(start, end).some(Boolean)) continue;
            for (let i = start; i < end; i += 1) taken[i] = true;
            matches.push({ name, start, end });
        }
    });

    const countries = matches.filter((item) => !REGION_LIKE_PLACES.has(item.name));
    if (countries.length !== 1) return null;
    const [country] = countries;
    const microRegion = `${original.slice(0, country.start)} ${original.slice(country.end)}`
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*,\s*/g, ', ')
        .replace(SEPARATORS, '')
        .trim();
    if (!microRegion) return null;
    let countryText = original.slice(country.start, country.end);
    // "BRAZIL" -> "Brazil"; other casing is kept as written.
    if (countryText === countryText.toUpperCase()) {
        countryText = countryText.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (all, sep, letter) => sep + letter.toUpperCase());
    }
    return { country: countryText, microRegion };
};
