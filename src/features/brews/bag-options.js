// Options for the bag drop-downs of the brew forms. When editing a brew every bag can be
// chosen, grouped as Open, Frozen and Finished; newest opened first within each group.

const escapeHtml = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const getOpenedAtMs = (bean) => {
    const raw = bean?.openedDate;
    if (!raw) return Number.NEGATIVE_INFINITY;
    const dateObj = typeof raw.toDate === 'function' ? raw.toDate() : new Date(raw);
    const ms = dateObj instanceof Date ? dateObj.getTime() : NaN;
    return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
};

export const getBagGroup = (bean) => {
    if (bean?.archived) return 'finished';
    if (bean?.frozen) return 'frozen';
    return 'open';
};

const BAG_GROUPS = [
    { key: 'open', label: 'Open' },
    { key: 'frozen', label: 'Frozen' },
    { key: 'finished', label: 'Finished' }
];

export const buildBagOptionsHtml = ({ beans = [], getLabel, emptyLabel, grouped = true }) => {
    const labelOf = (bean) => getLabel(bean) || '';
    const sorted = [...beans].sort((a, b) => {
        const openedDelta = getOpenedAtMs(b) - getOpenedAtMs(a);
        if (openedDelta !== 0) return openedDelta;
        return labelOf(a).toLowerCase().localeCompare(labelOf(b).toLowerCase());
    });
    const optionHtml = (bean) => `<option value="${escapeHtml(bean.id)}">${escapeHtml(labelOf(bean))}</option>`;
    const head = `<option value="">${escapeHtml(emptyLabel)}</option>`;
    if (!grouped) return head + sorted.map(optionHtml).join('');
    return (
        head +
        BAG_GROUPS.map(({ key, label }) => {
            const items = sorted.filter((bean) => getBagGroup(bean) === key);
            if (!items.length) return '';
            return `<optgroup label="${label}">${items.map(optionHtml).join('')}</optgroup>`;
        }).join('')
    );
};
