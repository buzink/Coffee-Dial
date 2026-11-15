import { FLAVOUR_ZONES, buildFlavourProfile } from '../../core/flavour-profile.js';

// The thumb stays inside the rounded ends of the track.
const clampToTrack = (position) => Math.min(97, Math.max(3, position));

const describe = (position, zone) => {
    const within = position - FLAVOUR_ZONES.indexOf(zone) * 25;
    if (within < 6 && zone.key !== 'classic') return `${zone.label}, near ${FLAVOUR_ZONES[FLAVOUR_ZONES.indexOf(zone) - 1].label}`;
    if (within > 19 && zone.key !== 'wild') return `${zone.label}, near ${FLAVOUR_ZONES[FLAVOUR_ZONES.indexOf(zone) + 1].label}`;
    return zone.label;
};

const renderZones = (activeKey) => {
    const list = document.getElementById('statsFlavourZones');
    if (!list) return;
    list.replaceChildren(...FLAVOUR_ZONES.map((zone) => {
        const li = document.createElement('li');
        li.className = 'flavour-zone';
        li.classList.toggle('is-active', zone.key === activeKey);
        const label = document.createElement('span');
        label.className = 'flavour-zone-label';
        label.textContent = zone.label;
        const notes = document.createElement('span');
        notes.className = 'flavour-zone-notes';
        notes.textContent = zone.notes;
        li.append(label, notes);
        return li;
    }));
};

const renderFactors = (profile) => {
    const list = document.getElementById('statsFlavourFactors');
    if (!list) return;
    const totalWeight = profile.factors.reduce((sum, f) => sum + f.weight, 0);
    list.replaceChildren(...profile.factors.map((factor) => {
        const li = document.createElement('li');
        li.className = 'flavour-factor';
        const name = document.createElement('span');
        name.className = 'flavour-factor-name';
        name.textContent = factor.label;
        const weight = document.createElement('span');
        weight.className = 'flavour-factor-weight';
        weight.textContent = `${Math.round((factor.weight / totalWeight) * 100)}%`;
        weight.title = 'Weight of this clue when every clue is known';
        const track = document.createElement('span');
        track.className = 'flavour-factor-track';
        if (factor.position !== null) {
            const dot = document.createElement('span');
            dot.className = 'flavour-factor-dot';
            dot.style.left = `${clampToTrack(factor.position)}%`;
            track.appendChild(dot);
        }
        const count = document.createElement('span');
        count.className = 'flavour-factor-count';
        count.textContent = factor.brews ? `${factor.brews} ${factor.brews === 1 ? 'brew' : 'brews'}` : 'no data';
        li.setAttribute('aria-label', factor.position === null
            ? `${factor.label}: no data`
            : `${factor.label}, weight ${weight.textContent}: ${FLAVOUR_ZONES[Math.min(3, Math.floor(factor.position / 25))].label}, from ${count.textContent}`);
        li.append(name, weight, track, count);
        return li;
    }));
};

// Where the brews in the chosen period land between Classic and Wild.
export const renderFlavour = ({ brews = [], getCoffeeTypeDisplay }) => {
    const profile = buildFlavourProfile(brews, (brew) => getCoffeeTypeDisplay(brew));
    const slider = document.getElementById('statsFlavourSlider');
    const thumb = document.getElementById('statsFlavourThumb');
    const note = document.getElementById('statsFlavourNote');
    renderZones(profile.zone?.key);
    renderFactors(profile);
    if (!slider || !thumb) return;
    if (profile.position === null) {
        thumb.hidden = true;
        slider.removeAttribute('aria-valuenow');
        slider.setAttribute('aria-valuetext', 'No brews with coffee details yet');
        if (note) note.textContent = brews.length ? 'None of these brews has a coffee with roast, process or origin' : 'No brews in this period';
        return;
    }
    const text = describe(profile.position, profile.zone);
    thumb.hidden = false;
    thumb.style.left = `${clampToTrack(profile.position)}%`;
    slider.setAttribute('aria-valuenow', String(Math.round(profile.position)));
    slider.setAttribute('aria-valuetext', text);
    if (note) {
        const counted = profile.brews === profile.totalBrews
            ? `${profile.brews} ${profile.brews === 1 ? 'brew' : 'brews'}`
            : `${profile.brews} of ${profile.totalBrews} brews`;
        note.textContent = `${text} · from ${counted}, roast level and process weigh most`;
    }
};
