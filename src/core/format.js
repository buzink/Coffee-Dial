// Always five stars: the rating in yellow, the rest empty, so the scale is visible.
export const getStarDisplay = (r, sizeClass = 'text-xs') => {
    const filled = Math.max(0, Math.min(5, Math.round(Number(r) || 0)));
    let html = '';
    for (let i = 0; i < 5; i++) {
        html += `<i class="fa-solid fa-star ${sizeClass} ${i < filled ? 'text-yellow-400' : 'star-empty'}"></i>`;
    }
    return html;
};

export const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
};

// Brew time in form fields: shown as m:ss, stored as seconds.
export const formatBrewTimeInput = (seconds) => {
    const total = Math.round(Number(seconds));
    if (seconds === '' || seconds === null || seconds === undefined || !Number.isFinite(total) || total < 0) return '';
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// Accepts "3:05", "3m 5s", "3m", "45s" and plain seconds ("185"). Returns NaN when empty or unreadable.
export const parseBrewTimeInput = (value) => {
    const text = String(value ?? '').trim().toLowerCase().replace(',', '.');
    if (!text) return NaN;
    const colon = text.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
    if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
    const units = text.match(/^(?:(\d+(?:\.\d+)?)\s*m(?:in)?)?\s*(?:(\d+(?:\.\d+)?)\s*s(?:ec)?)?$/);
    if (units && (units[1] || units[2])) return Number(units[1] || 0) * 60 + Number(units[2] || 0);
    const plain = Number(text);
    return Number.isFinite(plain) ? plain : NaN;
};

export const getRoastBadge = (roast) => {
    if (!roast) return '';
    const map = {
        Ultralight: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-900/20',
        Light: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800',
        Medium: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-800',
        'Medium-Dark': 'bg-[#d6ccc2] text-[#5e4b41] border-[#c0b4aa] dark:bg-[#57534e]/50 dark:text-gray-200 dark:border-[#57534e]',
        Dark: 'bg-gray-800 text-gray-100 border-gray-700 dark:bg-black dark:text-gray-300 dark:border-gray-800'
    };
    return `<span class="${map[roast] || 'bg-gray-100 dark:bg-gray-800'} text-xs font-medium px-2 py-0.5 rounded-full border pointer-events-none select-none">${roast}</span>`;
};

export const formatBeanOpenedDate = (value) => {
    if (!value) return '';
    const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    if (isNaN(dateObj)) return '';
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};

// Brew time from a form field as seconds to save, or null when empty.
export const parseBrewTime = (value) => {
    const seconds = parseBrewTimeInput(value);
    return Number.isFinite(seconds) ? seconds : null;
};
