// Options for the gear drop-downs of the brew forms (Add/Edit brew and quick edit),
// limited to the chosen method and grouped by gear type: types A–Z with Other last, names A–Z within each type.

const escapeHtml = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const OTHER_TYPE = 'Other';

export const toGearOption = (item) => ({
    id: item.id,
    label: (item.name || 'Untitled gear').toString().trim() || 'Untitled gear',
    type: (item.type || '').toString().trim() || OTHER_TYPE,
    methods: Array.isArray(item.methods) ? item.methods : []
});

// Gear fits a method when it lists that method, or lists no methods at all (e.g. a grinder
// used for everything). No method or "Other" shows all gear; chosen gear always stays visible.
export const filterGearOptionsForMethod = (options, method, selection) => {
    const value = (method || '').toString().trim();
    if (!value || value === 'Other') return options;
    return options.filter(
        (option) => selection.has(option.id) || !option.methods.length || option.methods.includes(value)
    );
};

const groupGearOptions = (options) => {
    const groups = new Map();
    options.forEach((option) => {
        if (!groups.has(option.type)) groups.set(option.type, []);
        groups.get(option.type).push(option);
    });
    return [...groups.entries()]
        .sort(([a], [b]) => {
            if (a === OTHER_TYPE) return 1;
            if (b === OTHER_TYPE) return -1;
            return a.toLowerCase().localeCompare(b.toLowerCase());
        })
        .map(([type, items]) => ({
            type,
            items: [...items].sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()))
        }));
};

// `optionAttr` is the data attribute the form's click handler looks for, e.g. "data-brew-gear-option".
export const buildGearDropdownHtml = (options, selection, optionAttr) => {
    if (!options.length) {
        return '<div class="px-3 py-2 text-xs text-coffee-500 dark:text-[#a8a29e]">No gear for this method</div>';
    }
    return groupGearOptions(options)
        .map(({ type, items }) => {
            const header = `<div class="px-3 pt-2 text-[10px] font-bold uppercase tracking-wide text-coffee-500 dark:text-[#78716c]">${escapeHtml(type)}</div>`;
            const rows = items
                .map((option) => {
                    const selected = selection.has(option.id);
                    const selectedCls = selected ? 'bg-coffee-100 dark:bg-[#34302e] font-semibold' : '';
                    const icon = selected ? '<i class="fa-solid fa-check text-coffee-700 dark:text-[#d6ccc2]"></i>' : '';
                    return `<button type="button" ${optionAttr}="${escapeHtml(option.id)}" class="w-full text-left px-3 py-2 text-xs hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-800 dark:text-[#d6ccc2] flex items-center justify-between ${selectedCls}"><span>${escapeHtml(option.label)}</span>${icon}</button>`;
                })
                .join('');
            return header + rows;
        })
        .join('');
};
