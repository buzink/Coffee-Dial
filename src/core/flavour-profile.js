// Where coffees land on a taste slider from Classic (0) to Wild (100), after the clues on a bag of
// coffee in Daddy Got Coffee's "Stop Buying the Wrong Coffee": roast level moves the slider most,
// then process, then origin, altitude and variety. Each clue gives a position on the slider; a brew's
// position is the weighted average of the clues its coffee has.
import { parseAltitude } from './altitude.js';

export const FLAVOUR_ZONES = [
    { key: 'classic', label: 'Classic', notes: 'nuts · caramel' },
    { key: 'balanced', label: 'Balanced', notes: 'toffee · sweetness' },
    { key: 'bright', label: 'Bright', notes: 'berries · florals' },
    { key: 'wild', label: 'Wild', notes: 'tropical · funky' }
];

// The most important clue weighs most. A co-ferment "overrides almost everything else", so its
// process weight is multiplied.
export const FLAVOUR_FACTORS = [
    { key: 'roast', label: 'Roast level', weight: 5 },
    { key: 'process', label: 'Process', weight: 4 },
    { key: 'origin', label: 'Origin', weight: 2 },
    { key: 'altitude', label: 'Altitude', weight: 1.5 },
    { key: 'variety', label: 'Variety', weight: 1 }
];
const COFERMENT_WEIGHT_FACTOR = 3;

const clean = (value) => {
    const text = (value ?? '').toString().trim().toLowerCase();
    return text && text !== '-' && text !== 'unknown' ? text : '';
};

// Without a roast level on the bag, a specialty roaster is usually light to medium.
const ASSUMED_ROAST = 50;
export const roastScore = (value) => {
    const text = clean(value);
    if (!text) return null;
    if (/ultra|nordic|very light|extra light/.test(text)) return 72;
    if (/espresso/.test(text)) return 18;
    if (/medium[\s-]*dark|dark[\s-]*medium/.test(text)) return 25;
    if (/light[\s-]*medium|medium[\s-]*light|omni/.test(text)) return 50;
    if (/dark|french|italian/.test(text)) return 10;
    if (/light|filter/.test(text)) return 62;
    if (/medium/.test(text)) return 40;
    return null;
};

// { score, coferment } or null.
export const processScore = (value) => {
    const text = clean(value);
    if (!text) return null;
    if (/co[\s-]?ferment|infus/.test(text)) return { score: 97, coferment: true };
    if (/anaerob|carbonic|macerat|extended|thermal|experiment|double[\s-]*ferment|yeast|koji|lactic|ferment/.test(text)) return { score: 85 };
    if (/wet[\s-]*hull|giling|semi[\s-]*wash/.test(text)) return { score: 18 };
    if (/black honey/.test(text)) return { score: 55 };
    if (/red honey/.test(text)) return { score: 48 };
    if (/(yellow|white) honey/.test(text)) return { score: 42 };
    if (/honey|pulp/.test(text)) return { score: 45 };
    if (/natural|dry/.test(text)) return { score: 65 };
    if (/wash|wet/.test(text)) return { score: 22 };
    return null;
};

// Generalisations by country; Colombia's Huila and Nariño lean bright.
const ORIGIN_SCORES = [
    [/brazil|brasil/, 15], [/vietnam/, 8], [/sumatra|indonesia|sulawesi|java/, 16], [/india/, 20],
    [/uganda/, 22], [/papua|png/, 32], [/china|yunnan/, 30], [/laos|myanmar|thailand/, 42],
    [/guatemala/, 30], [/mexico/, 30], [/honduras/, 33], [/nicaragua/, 33], [/salvador/, 35],
    [/peru/, 38], [/bolivia/, 45], [/ecuador/, 50], [/colombia/, 45], [/costa rica/, 50],
    [/panama/, 60], [/ethiopia/, 62], [/kenya/, 68], [/rwanda/, 58], [/burundi/, 58],
    [/tanzania/, 55], [/congo|drc/, 55], [/yemen/, 62], [/malawi|zambia|zimbabwe/, 50],
    [/hawaii|kona/, 40], [/jamaica/, 35]
];
export const originScore = (origin, microRegion = '') => {
    const text = clean(origin);
    if (!text) return null;
    const scores = text.split(/[,/&+]|\band\b/).map((part) => {
        const hit = ORIGIN_SCORES.find(([pattern]) => pattern.test(part));
        return hit ? hit[1] : null;
    }).filter((s) => s !== null);
    if (!scores.length) return /blend/.test(text) ? 25 : null;
    const score = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    if (scores.length === 1 && /colombia/.test(text) && /huila|nari/.test(clean(microRegion))) return 55;
    return score;
};

// Higher grows slower and denser, brighter; lower is rounder. 600 m → 20, 2100 m → 65.
export const altitudeScore = (value) => {
    const metres = parseAltitude(value);
    if (metres === null) return null;
    return Math.min(65, Math.max(20, 20 + ((metres - 600) * 45) / 1500));
};

// Mostly ignorable; only a few varieties say something on their own.
export const varietyScore = (value) => {
    const text = clean(value);
    if (!text) return null;
    if (/gesha|geisha/.test(text)) return 72;
    if (/wush/.test(text)) return 70;
    if (/sl[\s-]?(28|34)/.test(text)) return 68;
    if (/sidra/.test(text)) return 65;
    if (/pacamara/.test(text)) return 60;
    if (/heirloom|landrace|74110|74158/.test(text)) return 60;
    if (/robusta|canephora/.test(text)) return 8;
    return null;
};

// A dark roast flattens what origin, altitude and variety would show, so it weighs more.
const weightFor = (key, weight, score, process) => {
    if (key === 'process' && process?.coferment) return weight * COFERMENT_WEIGHT_FACTOR;
    if (key === 'roast' && score <= 18) return weight * 2;
    if (key === 'roast' && score <= 25) return weight * 1.5;
    return weight;
};

// The clues of one coffee (as getCoffeeTypeDisplay returns it), each { score, weight } or null.
export const flavourFactorsForCoffee = (coffee = {}) => {
    const process = processScore(coffee.processing);
    const factors = {
        roast: roastScore(coffee.roastType),
        process: process?.score ?? null,
        origin: originScore(coffee.origin, coffee.originMicroRegion),
        altitude: altitudeScore(coffee.altitude),
        variety: varietyScore(coffee.variety)
    };
    // A coffee we know nothing about tells us nothing, not "light to medium".
    if (Object.values(factors).every((score) => score === null)) return null;
    const assumedRoast = factors.roast === null;
    if (assumedRoast) factors.roast = ASSUMED_ROAST;
    return Object.fromEntries(FLAVOUR_FACTORS.map(({ key, weight }) => [key, factors[key] === null ? null : {
        score: factors[key],
        weight: weightFor(key, weight, factors[key], process),
        assumed: key === 'roast' && assumedRoast
    }]));
};

export const weightedPosition = (factors) => {
    let sum = 0;
    let weights = 0;
    Object.values(factors || {}).forEach((factor) => {
        if (!factor) return;
        sum += factor.score * factor.weight;
        weights += factor.weight;
    });
    return weights ? sum / weights : null;
};

export const flavourZone = (position) => FLAVOUR_ZONES[Math.min(3, Math.max(0, Math.floor(position / 25)))];

// Every brew counts once, so a coffee brewed often pulls the slider more than one brewed once.
export const buildFlavourProfile = (brews = [], getCoffee) => {
    const perFactor = Object.fromEntries(FLAVOUR_FACTORS.map(({ key }) => [key, { sum: 0, count: 0 }]));
    let positionSum = 0;
    let counted = 0;
    brews.forEach((brew) => {
        const factors = flavourFactorsForCoffee(getCoffee(brew) || {});
        if (!factors) return;
        const position = weightedPosition(factors);
        if (position === null) return;
        positionSum += position;
        counted += 1;
        FLAVOUR_FACTORS.forEach(({ key }) => {
            const factor = factors[key];
            if (!factor || factor.assumed) return;
            perFactor[key].sum += factor.score;
            perFactor[key].count += 1;
        });
    });
    const position = counted ? positionSum / counted : null;
    return {
        position,
        zone: position === null ? null : flavourZone(position),
        brews: counted,
        totalBrews: brews.length,
        factors: FLAVOUR_FACTORS.map(({ key, label, weight }) => ({
            key,
            label,
            weight,
            brews: perFactor[key].count,
            position: perFactor[key].count ? perFactor[key].sum / perFactor[key].count : null
        }))
    };
};
